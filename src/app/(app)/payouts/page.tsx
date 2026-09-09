import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money, moneyShort, dateStr } from "@/lib/format";
import { label, PAYOUT_STATUS } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { PayoutForm } from "./PayoutForm";
import { PayoutRowActions } from "./PayoutRowActions";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  await requirePermission("payouts.view");

  const [payouts, owners] = await Promise.all([
    db.payout.findMany({ include: { owner: true }, orderBy: [{ status: "asc" }, { periodTo: "desc" }] }),
    db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);

  const pendingAmount = payouts.filter((p) => p.status !== "PAID").reduce((a, p) => a + p.netAmount, 0);
  const paidAmount = payouts.filter((p) => p.status === "PAID").reduce((a, p) => a + p.netAmount, 0);

  return (
    <>
      <PageHead title="توريدات المُلاك" sub={`${payouts.length} توريداً`} />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="بانتظار التوريد" v={moneyShort(pendingAmount)} s={`${payouts.filter((p) => p.status !== "PAID").length} توريد`} tone={pendingAmount > 0 ? "alert" : undefined} />
          <Kpi k="مورّد فعلياً" v={moneyShort(paidAmount)} />
          <Kpi k="إجمالي التوريدات" v={payouts.length} />
        </div>

        <div className="card">
          <div className="card-head"><h2>توليد توريد جديد</h2></div>
          <div className="card-body">
            <PayoutForm owners={owners} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>سجل التوريدات</h2></div>
          {payouts.length === 0 ? <Empty msg="لا توجد توريدات." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th><th>المالك</th><th>الفترة</th>
                    <th className="num">المحصّل</th><th className="num">المصروفات</th><th className="num">العمولة</th>
                    <th className="num">الصافي</th><th>الحالة</th><th>المرجع</th><th />
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="b" dir="ltr">{p.number}</td>
                      <td className="sm"><Link href={`/owners/${p.ownerId}`}>{p.owner.name}</Link></td>
                      <td className="sm nowrap">{dateStr(p.periodFrom)} — {dateStr(p.periodTo)}</td>
                      <td className="num nowrap">{money(p.collected)}</td>
                      <td className="num nowrap">{money(p.expenses)}</td>
                      <td className="num nowrap">{money(p.commission)}</td>
                      <td className="num nowrap b">{money(p.netAmount)}</td>
                      <td><Status value={p.status} label={label(PAYOUT_STATUS, p.status)} /></td>
                      <td className="sm mute" dir="ltr">{p.reference ?? "—"}</td>
                      <td><PayoutRowActions id={p.id} status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
