import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardMetrics } from "@/lib/finance";
import { money, moneyShort, dateStr, pct, daysUntil } from "@/lib/format";
import { label, LEASE_STATUS, PROPERTY_TYPES, INVOICE_STATUS } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await requireSession();
  const m = await dashboardMetrics();
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const [expiring, overdue, expiringDocs, topProperties] = await Promise.all([
    db.lease.findMany({
      where: { status: "ACTIVE", endDate: { lte: in60, gte: now } },
      include: { unit: { include: { property: true } }, tenant: true },
      orderBy: { endDate: "asc" },
      take: 8,
    }),
    db.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } },
      include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.document.findMany({
      where: { expiryDate: { lte: in60, gte: now } },
      orderBy: { expiryDate: "asc" },
      take: 6,
    }),
    db.property.findMany({
      include: { owner: true, units: { select: { status: true } } },
      orderBy: { marketValue: "desc" },
      take: 6,
    }),
  ]);

  return (
    <>
      <PageHead
        title={`أهلاً، ${session.name}`}
        sub={`الوضع التشغيلي والمالي كما هو الآن — ${dateStr(now)}`}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi
            k="الأصول تحت الإدارة"
            v={moneyShort(m.assetsUnderManagement)}
            s={`${m.properties} عقاراً لـ ${m.owners} مالكاً`}
            tone="accent"
          />
          <Kpi
            k="نسبة الإشغال"
            v={pct(m.occupancy, 0)}
            s={`${m.leasedUnits} مؤجرة من ${m.units} وحدة`}
          />
          <Kpi
            k="نسبة التحصيل"
            v={pct(m.collectionRate, 0)}
            s={`${money(m.paid)} من ${money(m.billed)}`}
          />
          <Kpi
            k="المتأخرات"
            v={moneyShort(m.overdue)}
            s={`${m.overdueCount} فاتورة متأخرة`}
            tone={m.overdue > 0 ? "alert" : undefined}
          />
          <Kpi k="المحصّل هذا العام" v={moneyShort(m.ytdCollected)} s="من بداية السنة الميلادية" />
          <Kpi
            k="عقود تنتهي خلال 60 يوماً"
            v={m.expiringLeases}
            s="تحتاج قرار تجديد"
            tone={m.expiringLeases > 0 ? "alert" : undefined}
          />
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head">
              <h2>عقود تنتهي قريباً</h2>
              <Link className="btn sm" href="/leases">الكل</Link>
            </div>
            {expiring.length === 0 ? (
              <Empty msg="لا توجد عقود تنتهي خلال 60 يوماً." />
            ) : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr>
                      <th>العقد</th>
                      <th>الوحدة</th>
                      <th>المستأجر</th>
                      <th>ينتهي</th>
                      <th className="num">متبقٍ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiring.map((l) => {
                      const d = daysUntil(l.endDate) ?? 0;
                      return (
                        <tr key={l.id}>
                          <td><Link href={`/leases/${l.id}`}>{l.number}</Link></td>
                          <td className="sm">{l.unit.property.name} — {l.unit.code}</td>
                          <td className="sm">{l.tenant.name}</td>
                          <td className="sm nowrap">{dateStr(l.endDate)}</td>
                          <td className="num">
                            <span className={`badge ${d <= 30 ? "danger" : "warn"}`}>{d} يوم</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>فواتير متأخرة</h2>
              <Link className="btn sm" href="/invoices?status=OVERDUE">الكل</Link>
            </div>
            {overdue.length === 0 ? (
              <Empty msg="لا توجد فواتير متأخرة. التحصيل منتظم." />
            ) : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>المستأجر</th>
                      <th>الاستحقاق</th>
                      <th className="num">المتبقي</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((i) => (
                      <tr key={i.id}>
                        <td><Link href={`/invoices/${i.id}`}>{i.number}</Link></td>
                        <td className="sm">{i.lease.tenant.name}</td>
                        <td className="sm nowrap">{dateStr(i.dueDate)}</td>
                        <td className="num nowrap">{money(i.total - i.paidTotal)}</td>
                        <td><Status value={i.status} label={label(INVOICE_STATUS, i.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head">
              <h2>أكبر العقارات بالقيمة</h2>
              <Link className="btn sm" href="/properties">الكل</Link>
            </div>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>العقار</th>
                    <th>المالك</th>
                    <th>النوع</th>
                    <th className="num">الإشغال</th>
                    <th className="num">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {topProperties.map((p) => {
                    const total = p.units.length;
                    const leased = p.units.filter((u) => u.status === "LEASED").length;
                    const r = total ? leased / total : 0;
                    return (
                      <tr key={p.id}>
                        <td><Link href={`/properties/${p.id}`}>{p.name}</Link></td>
                        <td className="sm">{p.owner.name}</td>
                        <td className="sm">{label(PROPERTY_TYPES, p.type)}</td>
                        <td className="num" style={{ minWidth: 92 }}>
                          <div className="sm">{leased}/{total}</div>
                          <div className="bar"><i style={{ width: `${r * 100}%` }} /></div>
                        </td>
                        <td className="num nowrap">{moneyShort(p.marketValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>وثائق تنتهي قريباً</h2>
              <Link className="btn sm" href="/documents">الكل</Link>
            </div>
            {expiringDocs.length === 0 ? (
              <Empty msg="لا توجد وثائق تنتهي خلال 60 يوماً." />
            ) : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>الوثيقة</th><th>الرقم</th><th>تنتهي</th><th className="num">متبقٍ</th></tr>
                  </thead>
                  <tbody>
                    {expiringDocs.map((d) => {
                      const days = daysUntil(d.expiryDate) ?? 0;
                      return (
                        <tr key={d.id}>
                          <td>{d.title}</td>
                          <td className="sm mute" dir="ltr">{d.number ?? "—"}</td>
                          <td className="sm nowrap">{dateStr(d.expiryDate)}</td>
                          <td className="num">
                            <span className={`badge ${days <= 30 ? "danger" : "warn"}`}>{days} يوم</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
