import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money, moneyShort, dateStr } from "@/lib/format";
import { label, INVOICE_STATUS } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePermission("invoices.view");
  const { status = "OPEN", q } = await searchParams;
  const now = new Date();

  const where =
    status === "OVERDUE" ? { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } }
    : status === "OPEN" ? { status: { in: ["UNPAID", "PARTIAL"] } }
    : status === "ALL" ? {}
    : { status };

  const invoices = await db.invoice.findMany({
    where: {
      ...where,
      ...(q ? { OR: [{ number: { contains: q } }, { lease: { tenant: { name: { contains: q } } } }] } : {}),
    },
    include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
    orderBy: { dueDate: "asc" },
    take: 300,
  });

  const totals = invoices.reduce(
    (a, i) => ({ total: a.total + i.total, paid: a.paid + i.paidTotal, due: a.due + (i.total - i.paidTotal) }),
    { total: 0, paid: 0, due: 0 },
  );

  const filters = [
    { k: "OPEN", l: "المفتوحة" }, { k: "OVERDUE", l: "المتأخرة" },
    { k: "PAID", l: "المحصّلة" }, { k: "ALL", l: "الكل" },
  ];

  return (
    <>
      <PageHead title="الفواتير والتحصيل" sub={`${invoices.length} فاتورة معروضة`} />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="إجمالي المعروض" v={moneyShort(totals.total)} />
          <Kpi k="المحصّل" v={moneyShort(totals.paid)} />
          <Kpi k="المتبقي" v={moneyShort(totals.due)} tone={totals.due > 0 ? "alert" : undefined} />
        </div>

        <div className="card card-body row">
          <div className="tabs" style={{ border: 0 }}>
            {filters.map((f) => (
              <Link key={f.k} href={`/invoices?status=${f.k}`} className={status === f.k ? "on" : ""}>{f.l}</Link>
            ))}
          </div>
          <div className="spacer" />
          <form method="get" className="row">
            <input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q ?? ""} placeholder="بحث برقم الفاتورة أو المستأجر" style={{ maxWidth: 250 }} />
            <button className="btn" type="submit">بحث</button>
          </form>
        </div>

        <div className="card">
          {invoices.length === 0 ? <Empty msg="لا توجد فواتير مطابقة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th><th>المستأجر</th><th>الوحدة</th><th>الفترة</th><th>الاستحقاق</th>
                    <th className="num">الإجمالي</th><th className="num">المحصّل</th><th className="num">المتبقي</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const late = ["UNPAID", "PARTIAL"].includes(i.status) && i.dueDate < now;
                    return (
                      <tr key={i.id}>
                        <td><Link href={`/invoices/${i.id}`} dir="ltr" className="b">{i.number}</Link></td>
                        <td className="sm">{i.lease.tenant.name}</td>
                        <td className="sm mute">{i.lease.unit.property.name} — {i.lease.unit.code}</td>
                        <td className="sm">{i.period ?? "—"}</td>
                        <td className="sm nowrap">
                          {dateStr(i.dueDate)}
                          {late ? <span className="badge danger" style={{ marginRight: 6 }}>متأخرة</span> : null}
                        </td>
                        <td className="num nowrap">{money(i.total)}</td>
                        <td className="num nowrap">{money(i.paidTotal)}</td>
                        <td className="num nowrap b">{money(i.total - i.paidTotal)}</td>
                        <td><Status value={i.status} label={label(INVOICE_STATUS, i.status)} /></td>
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
