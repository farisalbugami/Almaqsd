import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, dateStr, daysUntil } from "@/lib/format";
import { label, COMMISSION_TYPES, CONTRACT_STATUS, OWNER_TYPES } from "@/lib/labels";
import { PageHead, Status, Empty, Kpi } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const s = await requirePermission("owners.view");
  const contracts = await db.managementContract.findMany({
    include: { owner: { include: { properties: { select: { id: true } } } } },
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
  });

  const active = contracts.filter((c) => c.status === "ACTIVE");
  const expiring = active.filter((c) => (daysUntil(c.endDate) ?? 999) <= 90).length;

  return (
    <>
      <PageHead
        title="عقود الإدارة"
        sub={`${contracts.length} عقداً · ${active.length} ساري`}
        actions={can(s.role, "owners.edit") ? <Link className="btn primary" href="/contracts/new">+ عقد إدارة</Link> : null}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="العقود السارية" v={active.length} tone="accent" />
          <Kpi k="تنتهي خلال 90 يوماً" v={expiring} tone={expiring > 0 ? "alert" : undefined} s="تحتاج تجديداً" />
          <Kpi k="ملّاك بلا عقد ساري" v={new Set(contracts.map((c) => c.ownerId)).size - new Set(active.map((c) => c.ownerId)).size} />
        </div>

        <div className="card">
          {contracts.length === 0 ? (
            <Empty msg="لا توجد عقود إدارة." action={<Link className="btn primary" href="/contracts/new">إنشاء أول عقد</Link>} />
          ) : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th><th>المالك</th><th>التصنيف</th><th>الفترة</th>
                    <th>نوع العمولة</th><th className="num">القيمة</th><th className="num">سقف الصرف</th>
                    <th className="num">العقارات</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const d = daysUntil(c.endDate) ?? 999;
                    return (
                      <tr key={c.id}>
                        <td className="b" dir="ltr">{c.number}</td>
                        <td><Link href={`/owners/${c.ownerId}`}>{c.owner.name}</Link></td>
                        <td><Status value={c.owner.type} label={label(OWNER_TYPES, c.owner.type)} /></td>
                        <td className="sm nowrap">
                          {dateStr(c.startDate)} — {dateStr(c.endDate)}
                          {c.status === "ACTIVE" && d <= 90 ? <span className="badge warn" style={{ marginRight: 6 }}>{d} يوم</span> : null}
                        </td>
                        <td className="sm">{label(COMMISSION_TYPES, c.commissionType)}</td>
                        <td className="num nowrap">{c.commissionType === "FIXED_MONTHLY" ? money(c.commissionRate) : `${c.commissionRate}%`}</td>
                        <td className="num nowrap">{c.spendLimit > 0 ? money(c.spendLimit) : <span className="mute">بلا سقف</span>}</td>
                        <td className="num">{c.owner.properties.length}</td>
                        <td><Status value={c.status} label={label(CONTRACT_STATUS, c.status)} /></td>
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
