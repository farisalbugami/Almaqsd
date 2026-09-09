import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerStatement } from "@/lib/finance";
import { money, moneyShort, dateStr, pct, daysUntil } from "@/lib/format";
import {
  label, PROPERTY_TYPES, UNIT_STATUS, EXPENSE_CATEGORIES,
  COMMISSION_TYPES, PAYOUT_STATUS, OWNER_TYPES,
} from "@/lib/labels";
import { Kpi, Status, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Portal({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await requireSession();
  const { from, to } = await searchParams;
  if (!s.ownerId) notFound();

  const owner = await db.owner.findUnique({
    where: { id: s.ownerId },
    include: {
      properties: {
        include: {
          units: { include: { leases: { where: { status: "ACTIVE" }, include: { tenant: true } } } },
        },
        orderBy: { name: "asc" },
      },
      payouts: { orderBy: { periodTo: "desc" }, take: 12 },
      contracts: { where: { status: "ACTIVE" } },
    },
  });
  if (!owner) notFound();

  const now = new Date();
  const f = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
  const t = to ? new Date(to) : now;
  t.setHours(23, 59, 59, 999);

  const st = await ownerStatement(owner.id, f, t);

  const allUnits = owner.properties.flatMap((p) => p.units);
  const leased = allUnits.filter((u) => u.status === "LEASED").length;
  const portfolioValue = owner.properties.reduce((a, p) => a + (p.marketValue ?? 0), 0);
  const contractedRent = allUnits.flatMap((u) => u.leases).reduce((a, l) => a + l.annualRent, 0);
  const contract = owner.contracts[0];
  const yieldRate = portfolioValue ? contractedRent / portfolioValue : 0;

  return (
    <div className="stack">
      <div>
        <h1>{owner.name}</h1>
        <div className="sm mute">
          {label(OWNER_TYPES, owner.type)} · محفظة من {owner.properties.length} عقاراً و{allUnits.length} وحدة
          {contract ? ` · عقد إدارة ${contract.number}` : ""}
        </div>
      </div>

      <div className="grid g4">
        <Kpi k="قيمة المحفظة" v={moneyShort(portfolioValue)} s={`${owner.properties.length} عقاراً`} tone="accent" />
        <Kpi k="نسبة الإشغال" v={pct(allUnits.length ? leased / allUnits.length : 0, 0)} s={`${leased} من ${allUnits.length} وحدة`} />
        <Kpi k="الإيجار السنوي المتعاقد" v={moneyShort(contractedRent)} s={`عائد ${pct(yieldRate, 1)} من قيمة الأصل`} />
        <Kpi k="صافي التوريد للفترة" v={moneyShort(st.net)} s={`${dateStr(f)} — ${dateStr(t)}`} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>كشف الحساب</h2>
          <form method="get" className="row no-print">
            <input type="date" name="from" defaultValue={f.toISOString().slice(0, 10)} style={{ width: 145 }} />
            <input type="date" name="to" defaultValue={t.toISOString().slice(0, 10)} style={{ width: 145 }} />
            <button className="btn sm" type="submit">تحديث</button>
          </form>
        </div>
        <div className="card-body stack">
          <div className="tblwrap">
            <table>
              <tbody>
                <tr><td>إجمالي المبالغ المحصّلة من المستأجرين</td><td className="num b">{money(st.collected)}</td></tr>
                <tr><td>يُخصم: المصروفات على العقار</td><td className="num">({money(st.expenseTotal)})</td></tr>
                <tr>
                  <td>
                    يُخصم: عمولة إدارة الأملاك
                    {contract ? <span className="sm mute"> — {label(COMMISSION_TYPES, contract.commissionType)} {contract.commissionType === "FIXED_MONTHLY" ? money(contract.commissionRate) : `${contract.commissionRate}%`}</span> : null}
                  </td>
                  <td className="num">({money(st.commission)})</td>
                </tr>
                <tr className="tfoot"><td>صافي المستحق لك</td><td className="num">{money(st.net)}</td></tr>
              </tbody>
            </table>
          </div>
          {st.expenses.length > 0 ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>تفصيل المصروفات ({st.expenses.length})</summary>
              <div className="tblwrap" style={{ marginTop: 10 }}>
                <table>
                  <thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th className="num">المبلغ</th></tr></thead>
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
            </details>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>عقاراتك</h2></div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr><th>العقار</th><th>النوع</th><th>المدينة</th><th className="num">الوحدات</th><th className="num">الإشغال</th><th className="num">المحصّل بالفترة</th><th className="num">القيمة</th></tr>
            </thead>
            <tbody>
              {owner.properties.map((p) => {
                const l = p.units.filter((u) => u.status === "LEASED").length;
                const r = p.units.length ? l / p.units.length : 0;
                const row = st.byProperty.find((x) => x.property.id === p.id);
                return (
                  <tr key={p.id}>
                    <td className="b">{p.name}</td>
                    <td className="sm">{label(PROPERTY_TYPES, p.type)}</td>
                    <td className="sm">{p.city}</td>
                    <td className="num">{p.units.length}</td>
                    <td className="num" style={{ minWidth: 92 }}>
                      <div className="sm">{l} ({Math.round(r * 100)}%)</div>
                      <div className="bar"><i style={{ width: `${r * 100}%` }} /></div>
                    </td>
                    <td className="num nowrap">{money(row?.collected ?? 0)}</td>
                    <td className="num nowrap">{moneyShort(p.marketValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><h2>الوحدات والعقود</h2></div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>الوحدة</th><th>الحالة</th><th>المستأجر</th><th className="num">الإيجار</th><th>ينتهي</th></tr></thead>
              <tbody>
                {owner.properties.flatMap((p) =>
                  p.units.map((u) => {
                    const lease = u.leases[0];
                    const d = lease ? daysUntil(lease.endDate) ?? 999 : 999;
                    return (
                      <tr key={u.id}>
                        <td className="sm">{p.name} — <b>{u.code}</b></td>
                        <td><Status value={u.status} label={label(UNIT_STATUS, u.status)} /></td>
                        <td className="sm">{lease?.tenant.name ?? <span className="mute">—</span>}</td>
                        <td className="num nowrap">{lease ? money(lease.annualRent) : "—"}</td>
                        <td className="sm nowrap">
                          {lease ? dateStr(lease.endDate) : "—"}
                          {lease && d <= 60 ? <span className="badge warn" style={{ marginRight: 6 }}>{d} يوم</span> : null}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>سجل التوريدات</h2></div>
          {owner.payouts.length === 0 ? <Empty msg="لا توجد توريدات مسجلة بعد." /> : (
            <div className="tblwrap">
              <table>
                <thead><tr><th>الرقم</th><th>الفترة</th><th className="num">الصافي</th><th>الحالة</th><th>تاريخ التوريد</th></tr></thead>
                <tbody>
                  {owner.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="sm" dir="ltr">{p.number}</td>
                      <td className="sm nowrap">{dateStr(p.periodFrom)} — {dateStr(p.periodTo)}</td>
                      <td className="num nowrap b">{money(p.netAmount)}</td>
                      <td><Status value={p.status} label={label(PAYOUT_STATUS, p.status)} /></td>
                      <td className="sm nowrap">{p.paidAt ? dateStr(p.paidAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
