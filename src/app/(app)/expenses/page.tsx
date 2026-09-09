import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, moneyShort, dateStr } from "@/lib/format";
import { label, EXPENSE_CATEGORIES, CHARGE_TO } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { ApproveButtons } from "./ApproveButtons";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ charge?: string; category?: string; status?: string }> }) {
  const s = await requirePermission("expenses.view");
  const { charge, category, status } = await searchParams;

  const expenses = await db.expense.findMany({
    where: {
      ...(charge ? { chargeTo: charge } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    },
    include: { property: { include: { owner: { select: { name: true } } } }, unit: true },
    orderBy: { spentAt: "desc" },
    take: 300,
  });

  const total = expenses.reduce((a, e) => a + e.amount + e.vatAmount, 0);
  const onOwner = expenses.filter((e) => e.chargeTo === "OWNER").reduce((a, e) => a + e.amount + e.vatAmount, 0);
  const pending = expenses.filter((e) => e.status === "PENDING").length;

  return (
    <>
      <PageHead
        title="المصروفات"
        sub={`${expenses.length} مصروفاً`}
        actions={can(s.role, "expenses.edit") ? <Link className="btn primary" href="/expenses/new">+ مصروف جديد</Link> : null}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="إجمالي المصروفات" v={moneyShort(total)} />
          <Kpi k="محمّل على المُلاك" v={moneyShort(onOwner)} s="يُخصم من كشوف حساباتهم" tone="accent" />
          <Kpi k="محمّل على الشركة" v={moneyShort(total - onOwner)} />
          <Kpi k="بانتظار الاعتماد" v={pending} s="تجاوزت سقف الصرف" tone={pending > 0 ? "alert" : undefined} />
        </div>

        <form className="card card-body row" method="get">
          <select name="charge" defaultValue={charge ?? ""} style={{ maxWidth: 180 }}>
            <option value="">كل التحميلات</option>
            <option value="OWNER">على المالك</option>
            <option value="COMPANY">على الشركة</option>
          </select>
          <select name="category" defaultValue={category ?? ""} style={{ maxWidth: 180 }}>
            <option value="">كل التصنيفات</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ""} style={{ maxWidth: 160 }}>
            <option value="">كل الحالات</option>
            <option value="PENDING">معلّق</option>
            <option value="APPROVED">معتمد</option>
            <option value="REJECTED">مرفوض</option>
          </select>
          <button className="btn" type="submit">تصفية</button>
          {charge || category || status ? <Link className="btn sm" href="/expenses">إلغاء</Link> : null}
        </form>

        <div className="card">
          {expenses.length === 0 ? <Empty msg="لا توجد مصروفات مطابقة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th><th>التاريخ</th><th>العقار</th><th>البيان</th><th>التصنيف</th>
                    <th>المورّد</th><th>التحميل</th><th className="num">المبلغ</th><th>الحالة</th>
                    {can(s.role, "expenses.edit") ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="sm mute" dir="ltr">{e.number}</td>
                      <td className="sm nowrap">{dateStr(e.spentAt)}</td>
                      <td className="sm">
                        <Link href={`/properties/${e.propertyId}`}>{e.property.name}</Link>
                        {e.unit ? <span className="mute"> — {e.unit.code}</span> : null}
                      </td>
                      <td className="sm">{e.description}</td>
                      <td className="sm">{label(EXPENSE_CATEGORIES, e.category)}</td>
                      <td className="sm">{e.vendor ?? "—"}</td>
                      <td><span className={`badge ${e.chargeTo === "OWNER" ? "gold" : "info"}`}>{label(CHARGE_TO, e.chargeTo)}</span></td>
                      <td className="num nowrap b">{money(e.amount + e.vatAmount)}</td>
                      <td><Status value={e.status} label={e.status === "APPROVED" ? "معتمد" : e.status === "PENDING" ? "معلّق" : "مرفوض"} /></td>
                      {can(s.role, "expenses.edit") ? (
                        <td>{e.status === "PENDING" ? <ApproveButtons id={e.id} /> : null}</td>
                      ) : null}
                    </tr>
                  ))}
                  <tr className="tfoot"><td colSpan={7}>الإجمالي</td><td className="num">{money(total)}</td><td colSpan={can(s.role, "expenses.edit") ? 2 : 1} /></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
