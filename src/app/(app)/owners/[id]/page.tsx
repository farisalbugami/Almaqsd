import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { ownerStatement } from "@/lib/finance";
import { money, moneyShort, dateStr, pct } from "@/lib/format";
import {
  label, OWNER_TYPES, PROPERTY_TYPES, COMMISSION_TYPES, CONTRACT_STATUS,
  EXPENSE_CATEGORIES, PAYMENT_METHODS,
} from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { OwnerForm } from "../OwnerForm";
import { updateOwner } from "../actions";

export const dynamic = "force-dynamic";

function periodRange(from?: string, to?: string) {
  const now = new Date();
  const f = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
  const t = to ? new Date(to) : now;
  t.setHours(23, 59, 59, 999);
  return { from: f, to: t };
}

export default async function OwnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const s = await requirePermission("owners.view");
  const { id } = await params;
  const { tab = "statement", from, to } = await searchParams;

  const owner = await db.owner.findUnique({
    where: { id },
    include: {
      properties: { include: { units: { select: { status: true, marketRent: true } } }, orderBy: { name: "asc" } },
      contracts: { orderBy: { startDate: "desc" } },
      payouts: { orderBy: { periodTo: "desc" }, take: 12 },
    },
  });
  if (!owner) notFound();

  const range = periodRange(from, to);
  const st = await ownerStatement(owner.id, range.from, range.to);

  const allUnits = owner.properties.flatMap((p) => p.units);
  const leased = allUnits.filter((u) => u.status === "LEASED").length;
  const portfolioValue = owner.properties.reduce((a, p) => a + (p.marketValue ?? 0), 0);
  const activeContract = owner.contracts.find((c) => c.status === "ACTIVE");

  const tabs = [
    { key: "statement", label: "كشف الحساب" },
    { key: "properties", label: `العقارات (${owner.properties.length})` },
    { key: "contracts", label: `عقود الإدارة (${owner.contracts.length})` },
    { key: "payouts", label: `التوريدات (${owner.payouts.length})` },
    ...(can(s.role, "owners.edit") ? [{ key: "edit", label: "بيانات المالك" }] : []),
  ];

  const qs = (t: string) => `/owners/${owner.id}?tab=${t}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  return (
    <>
      <PageHead
        title={owner.name}
        sub={`${label(OWNER_TYPES, owner.type)} · ${owner.code}${owner.idNumber ? ` · ${owner.idNumber}` : ""}`}
        actions={<Link className="btn" href="/owners">رجوع</Link>}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="قيمة المحفظة" v={moneyShort(portfolioValue)} s={`${owner.properties.length} عقاراً`} tone="accent" />
          <Kpi k="الإشغال" v={pct(allUnits.length ? leased / allUnits.length : 0, 0)} s={`${leased} من ${allUnits.length} وحدة`} />
          <Kpi
            k="عمولة الإدارة"
            v={activeContract ? (activeContract.commissionType === "FIXED_MONTHLY" ? money(activeContract.commissionRate) : `${activeContract.commissionRate}%`) : "—"}
            s={activeContract ? label(COMMISSION_TYPES, activeContract.commissionType) : "لا يوجد عقد ساري"}
          />
          <Kpi k="صافي التوريد للفترة" v={moneyShort(st.net)} s={`${dateStr(range.from)} — ${dateStr(range.to)}`} />
        </div>

        <div className="tabs">
          {tabs.map((t) => (
            <Link key={t.key} href={qs(t.key)} className={tab === t.key ? "on" : ""}>
              {t.label}
            </Link>
          ))}
        </div>

        {tab === "statement" ? (
          <div className="stack">
            <form className="card card-body row no-print" method="get">
              <input type="hidden" name="tab" value="statement" />
              <label className="f"><span>من</span><input type="date" name="from" defaultValue={from ?? range.from.toISOString().slice(0, 10)} /></label>
              <label className="f"><span>إلى</span><input type="date" name="to" defaultValue={to ?? range.to.toISOString().slice(0, 10)} /></label>
              <button className="btn" type="submit" style={{ alignSelf: "end" }}>تحديث الفترة</button>
              <div className="spacer" />
              <Link className="btn dark" href={`/owners/${owner.id}/statement?from=${range.from.toISOString().slice(0,10)}&to=${range.to.toISOString().slice(0,10)}`} style={{ alignSelf: "end" }}>
                كشف حساب للطباعة
              </Link>
            </form>

            <div className="card">
              <div className="card-head"><h2>معادلة صافي التوريد</h2></div>
              <div className="card-body">
                <div className="grid g4">
                  <Kpi k="إجمالي المحصّل" v={money(st.collected)} s={`${st.payments.length} سند قبض`} />
                  <Kpi k="− المصروفات على المالك" v={money(st.expenseTotal)} s={`${st.expenses.length} مصروف`} />
                  <Kpi k="− عمولة الإدارة" v={money(st.commission)} s={activeContract ? label(COMMISSION_TYPES, activeContract.commissionType) : "بدون عقد"} />
                  <Kpi k="= صافي التوريد" v={money(st.net)} tone="accent" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h2>التفصيل حسب العقار</h2></div>
              {st.byProperty.length === 0 ? <Empty msg="لا توجد عقارات." /> : (
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr><th>العقار</th><th className="num">المحصّل</th><th className="num">المصروفات</th><th className="num">الصافي قبل العمولة</th></tr>
                    </thead>
                    <tbody>
                      {st.byProperty.map((r) => (
                        <tr key={r.property.id}>
                          <td><Link href={`/properties/${r.property.id}`}>{r.property.name}</Link></td>
                          <td className="num">{money(r.collected)}</td>
                          <td className="num">{money(r.expenses)}</td>
                          <td className="num b">{money(r.net)}</td>
                        </tr>
                      ))}
                      <tr className="tfoot">
                        <td>الإجمالي</td>
                        <td className="num">{money(st.collected)}</td>
                        <td className="num">{money(st.expenseTotal)}</td>
                        <td className="num">{money(st.collected - st.expenseTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid g2">
              <div className="card">
                <div className="card-head"><h3>سندات القبض في الفترة</h3></div>
                {st.payments.length === 0 ? <Empty msg="لا توجد مقبوضات." /> : (
                  <div className="tblwrap">
                    <table>
                      <thead><tr><th>التاريخ</th><th>المستأجر</th><th>الطريقة</th><th className="num">المبلغ</th></tr></thead>
                      <tbody>
                        {st.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="sm nowrap">{dateStr(p.paidAt)}</td>
                            <td className="sm">{p.invoice.lease.tenant.name}</td>
                            <td className="sm">{label(PAYMENT_METHODS, p.method)}</td>
                            <td className="num">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-head"><h3>المصروفات المحمّلة على المالك</h3></div>
                {st.expenses.length === 0 ? <Empty msg="لا توجد مصروفات." /> : (
                  <div className="tblwrap">
                    <table>
                      <thead><tr><th>التاريخ</th><th>البند</th><th>التصنيف</th><th className="num">المبلغ</th></tr></thead>
                      <tbody>
                        {st.expenses.map((e) => (
                          <tr key={e.id}>
                            <td className="sm nowrap">{dateStr(e.spentAt)}</td>
                            <td className="sm">{e.description}</td>
                            <td className="sm">{label(EXPENSE_CATEGORIES, e.category)}</td>
                            <td className="num">{money(e.amount + e.vatAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "properties" ? (
          <div className="card">
            {owner.properties.length === 0 ? <Empty msg="لا توجد عقارات مسجلة لهذا المالك." /> : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>الرمز</th><th>العقار</th><th>النوع</th><th>المدينة</th><th className="num">الوحدات</th><th className="num">القيمة السوقية</th></tr>
                  </thead>
                  <tbody>
                    {owner.properties.map((p) => {
                      const l = p.units.filter((u) => u.status === "LEASED").length;
                      return (
                        <tr key={p.id}>
                          <td className="sm mute" dir="ltr">{p.code}</td>
                          <td><Link href={`/properties/${p.id}`}>{p.name}</Link></td>
                          <td className="sm">{label(PROPERTY_TYPES, p.type)}</td>
                          <td className="sm">{p.city}</td>
                          <td className="num sm">{l} / {p.units.length}</td>
                          <td className="num nowrap">{moneyShort(p.marketValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "contracts" ? (
          <div className="card">
            {owner.contracts.length === 0 ? (
              <Empty msg="لا توجد عقود إدارة." action={<Link className="btn primary" href="/contracts/new">إنشاء عقد إدارة</Link>} />
            ) : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>الرقم</th><th>الفترة</th><th>نوع العمولة</th><th className="num">القيمة</th><th className="num">سقف الصرف</th><th>الحالة</th></tr>
                  </thead>
                  <tbody>
                    {owner.contracts.map((c) => (
                      <tr key={c.id}>
                        <td className="sm" dir="ltr">{c.number}</td>
                        <td className="sm nowrap">{dateStr(c.startDate)} — {dateStr(c.endDate)}</td>
                        <td className="sm">{label(COMMISSION_TYPES, c.commissionType)}</td>
                        <td className="num">{c.commissionType === "FIXED_MONTHLY" ? money(c.commissionRate) : `${c.commissionRate}%`}</td>
                        <td className="num">{money(c.spendLimit)}</td>
                        <td><Status value={c.status} label={label(CONTRACT_STATUS, c.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "payouts" ? (
          <div className="card">
            {owner.payouts.length === 0 ? <Empty msg="لا توجد توريدات مسجلة." action={<Link className="btn primary" href="/payouts">إدارة التوريدات</Link>} /> : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>الرقم</th><th>الفترة</th><th className="num">المحصّل</th><th className="num">المصروفات</th><th className="num">العمولة</th><th className="num">الصافي</th><th>الحالة</th></tr>
                  </thead>
                  <tbody>
                    {owner.payouts.map((p) => (
                      <tr key={p.id}>
                        <td className="sm" dir="ltr">{p.number}</td>
                        <td className="sm nowrap">{dateStr(p.periodFrom)} — {dateStr(p.periodTo)}</td>
                        <td className="num">{money(p.collected)}</td>
                        <td className="num">{money(p.expenses)}</td>
                        <td className="num">{money(p.commission)}</td>
                        <td className="num b">{money(p.netAmount)}</td>
                        <td><Status value={p.status} label={p.status === "PAID" ? "مورّد" : p.status === "APPROVED" ? "معتمد" : "مسودة"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "edit" && can(s.role, "owners.edit") ? (
          <div className="card card-body" style={{ maxWidth: 900 }}>
            <OwnerForm
              action={updateOwner.bind(null, owner.id)}
              initial={owner as unknown as Record<string, string | null>}
              submitLabel="حفظ التعديلات"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
