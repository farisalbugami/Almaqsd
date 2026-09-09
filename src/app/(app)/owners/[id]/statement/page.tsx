import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ownerStatement } from "@/lib/finance";
import { money, dateStr } from "@/lib/format";
import { label, OWNER_TYPES, COMMISSION_TYPES, EXPENSE_CATEGORIES } from "@/lib/labels";
import { Mark } from "@/components/Mark";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("owners.view");
  const { id } = await params;
  const { from, to } = await searchParams;

  const owner = await db.owner.findUnique({ where: { id } });
  if (!owner) notFound();

  const now = new Date();
  const f = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
  const t = to ? new Date(to) : now;
  t.setHours(23, 59, 59, 999);

  const st = await ownerStatement(owner.id, f, t);

  return (
    <div style={{ padding: 24, maxWidth: 940, margin: "0 auto" }}>
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <PrintButton />
        <a className="btn" href={`/owners/${owner.id}`}>رجوع</a>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row" style={{ borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 18 }}>
          <span style={{ color: "var(--gold)" }}><Mark size={34} /></span>
          <div>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 17, fontWeight: 600 }}>شركة المقصد لإدارة الأملاك والتسويق العقاري</div>
            <div className="sm mute">AL-MAQSD Property Management</div>
          </div>
          <div className="spacer" />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>كشف حساب مالك</div>
            <div className="sm mute">{dateStr(f)} — {dateStr(t)}</div>
          </div>
        </div>

        <dl className="dl" style={{ marginBottom: 20 }}>
          <dt>المالك</dt><dd className="b">{owner.name}</dd>
          <dt>التصنيف</dt><dd>{label(OWNER_TYPES, owner.type)}</dd>
          <dt>رمز المالك</dt><dd dir="ltr" style={{ textAlign: "right" }}>{owner.code}</dd>
          {owner.iban ? (<><dt>الآيبان</dt><dd dir="ltr" style={{ textAlign: "right" }}>{owner.iban}</dd></>) : null}
          <dt>عقد الإدارة</dt>
          <dd>
            {st.contract
              ? `${st.contract.number} — ${label(COMMISSION_TYPES, st.contract.commissionType)} (${st.contract.commissionType === "FIXED_MONTHLY" ? money(st.contract.commissionRate) : `${st.contract.commissionRate}%`})`
              : "لا يوجد عقد ساري"}
          </dd>
          <dt>تاريخ الإصدار</dt><dd>{dateStr(now)}</dd>
        </dl>

        <h3 style={{ marginBottom: 8 }}>ملخص الفترة</h3>
        <div className="tblwrap" style={{ marginBottom: 22 }}>
          <table>
            <tbody>
              <tr><td>إجمالي المبالغ المحصّلة</td><td className="num b">{money(st.collected)}</td></tr>
              <tr><td>يُخصم: المصروفات المحمّلة على المالك</td><td className="num">({money(st.expenseTotal)})</td></tr>
              <tr><td>يُخصم: عمولة إدارة الأملاك</td><td className="num">({money(st.commission)})</td></tr>
              <tr className="tfoot"><td>صافي المبلغ المستحق التوريد</td><td className="num">{money(st.net)}</td></tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ marginBottom: 8 }}>التفصيل حسب العقار</h3>
        <div className="tblwrap" style={{ marginBottom: 22 }}>
          <table>
            <thead><tr><th>العقار</th><th className="num">المحصّل</th><th className="num">المصروفات</th><th className="num">الصافي</th></tr></thead>
            <tbody>
              {st.byProperty.map((r) => (
                <tr key={r.property.id}>
                  <td>{r.property.name}</td>
                  <td className="num">{money(r.collected)}</td>
                  <td className="num">{money(r.expenses)}</td>
                  <td className="num">{money(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {st.expenses.length > 0 ? (
          <>
            <h3 style={{ marginBottom: 8 }}>بيان المصروفات</h3>
            <div className="tblwrap" style={{ marginBottom: 22 }}>
              <table>
                <thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>المورّد</th><th className="num">المبلغ</th></tr></thead>
                <tbody>
                  {st.expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="sm nowrap">{dateStr(e.spentAt)}</td>
                      <td className="sm">{e.description}</td>
                      <td className="sm">{label(EXPENSE_CATEGORIES, e.category)}</td>
                      <td className="sm">{e.vendor ?? "—"}</td>
                      <td className="num">{money(e.amount + e.vatAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div className="sm mute" style={{ borderTop: "1px solid var(--rule)", paddingTop: 12, marginTop: 8 }}>
          كشف آلي صادر من منظومة المقصد. المبالغ محتسبة على أساس المحصّل فعلياً خلال الفترة، لا على أساس الاستحقاق.
          للاستفسار: الفريق المالي — شركة المقصد لإدارة الأملاك والتسويق العقاري.
        </div>
      </div>
    </div>
  );
}
