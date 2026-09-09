import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, moneyShort, dateStr, daysUntil } from "@/lib/format";
import { label, LEASE_STATUS } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const s = await requirePermission("leases.view");
  const { status = "ACTIVE", q } = await searchParams;

  const leases = await db.lease.findMany({
    where: {
      ...(status && status !== "ALL" ? { status } : {}),
      ...(q ? { OR: [{ number: { contains: q } }, { tenant: { name: { contains: q } } }, { ejarNumber: { contains: q } }] } : {}),
    },
    include: {
      tenant: true,
      unit: { include: { property: { include: { owner: { select: { name: true } } } } } },
      invoices: { select: { total: true, paidTotal: true, status: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const activeRent = leases.filter((l) => l.status === "ACTIVE").reduce((a, l) => a + l.annualRent, 0);
  const expiring = leases.filter((l) => l.status === "ACTIVE" && (daysUntil(l.endDate) ?? 999) <= 60).length;

  const filters = [
    { k: "ACTIVE", l: "السارية" }, { k: "EXPIRED", l: "المنتهية" },
    { k: "TERMINATED", l: "المفسوخة" }, { k: "ALL", l: "الكل" },
  ];

  return (
    <>
      <PageHead
        title="عقود الإيجار"
        sub={`${leases.length} عقداً`}
        actions={can(s.role, "leases.edit") ? <Link className="btn primary" href="/leases/new">+ عقد جديد</Link> : null}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="الإيجار السنوي المتعاقد" v={moneyShort(activeRent)} s="العقود السارية" tone="accent" />
          <Kpi k="عقود تنتهي خلال 60 يوماً" v={expiring} s="تحتاج قرار تجديد" tone={expiring > 0 ? "alert" : undefined} />
          <Kpi k="عدد العقود المعروضة" v={leases.length} />
        </div>

        <div className="card card-body row">
          <div className="tabs" style={{ border: 0 }}>
            {filters.map((f) => (
              <Link key={f.k} href={`/leases?status=${f.k}`} className={status === f.k ? "on" : ""}>{f.l}</Link>
            ))}
          </div>
          <div className="spacer" />
          <form method="get" className="row">
            <input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q ?? ""} placeholder="بحث برقم العقد أو المستأجر" style={{ maxWidth: 240 }} />
            <button className="btn" type="submit">بحث</button>
          </form>
        </div>

        <div className="card">
          {leases.length === 0 ? <Empty msg="لا توجد عقود مطابقة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th><th>الوحدة</th><th>المالك</th><th>المستأجر</th>
                    <th>الفترة</th><th className="num">الإيجار السنوي</th><th className="num">التحصيل</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((l) => {
                    const billed = l.invoices.filter((i) => i.status !== "CANCELLED").reduce((a, i) => a + i.total, 0);
                    const paid = l.invoices.reduce((a, i) => a + i.paidTotal, 0);
                    const r = billed ? paid / billed : 0;
                    const days = daysUntil(l.endDate) ?? 999;
                    return (
                      <tr key={l.id}>
                        <td><Link href={`/leases/${l.id}`} className="b" dir="ltr">{l.number}</Link></td>
                        <td className="sm">{l.unit.property.name} — {l.unit.code}</td>
                        <td className="sm mute">{l.unit.property.owner.name}</td>
                        <td className="sm">{l.tenant.name}</td>
                        <td className="sm nowrap">
                          {dateStr(l.startDate)} — {dateStr(l.endDate)}
                          {l.status === "ACTIVE" && days <= 60 ? <span className="badge danger" style={{ marginRight: 6 }}>{days} يوم</span> : null}
                        </td>
                        <td className="num nowrap">{money(l.annualRent)}</td>
                        <td className="num" style={{ minWidth: 96 }}>
                          <div className="sm">{Math.round(r * 100)}%</div>
                          <div className="bar slate"><i style={{ width: `${r * 100}%` }} /></div>
                        </td>
                        <td><Status value={l.status} label={label(LEASE_STATUS, l.status)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
