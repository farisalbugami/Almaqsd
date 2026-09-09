import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, dateStr, daysUntil, pct } from "@/lib/format";
import { label, LEASE_STATUS, INVOICE_STATUS, UNIT_TYPES } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { LeaseActions } from "./LeaseActions";

export const dynamic = "force-dynamic";

export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission("leases.view");
  const { id } = await params;

  const lease = await db.lease.findUnique({
    where: { id },
    include: {
      tenant: true,
      unit: { include: { property: { include: { owner: true } } } },
      invoices: { orderBy: { dueDate: "asc" }, include: { payments: true } },
    },
  });
  if (!lease) notFound();

  const billed = lease.invoices.filter((i) => i.status !== "CANCELLED").reduce((a, i) => a + i.total, 0);
  const paid = lease.invoices.reduce((a, i) => a + i.paidTotal, 0);
  const outstanding = billed - paid;
  const overdue = lease.invoices
    .filter((i) => ["UNPAID", "PARTIAL"].includes(i.status) && i.dueDate < new Date())
    .reduce((a, i) => a + (i.total - i.paidTotal), 0);
  const days = daysUntil(lease.endDate) ?? 0;

  return (
    <>
      <PageHead
        title={`عقد ${lease.number}`}
        sub={`${lease.unit.property.name} — ${lease.unit.code} · ${lease.tenant.name}`}
        actions={<Link className="btn" href="/leases">رجوع</Link>}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="الإيجار السنوي" v={money(lease.annualRent)} s={`${lease.installments} دفعة سنوياً`} tone="accent" />
          <Kpi k="نسبة التحصيل" v={pct(billed ? paid / billed : 0, 0)} s={`${money(paid)} من ${money(billed)}`} />
          <Kpi k="المتبقي" v={money(outstanding)} s={overdue > 0 ? `منه ${money(overdue)} متأخر` : "لا توجد متأخرات"} tone={overdue > 0 ? "alert" : undefined} />
          <Kpi
            k="حالة العقد"
            v={<Status value={lease.status} label={label(LEASE_STATUS, lease.status)} />}
            s={lease.status === "ACTIVE" ? (days > 0 ? `يتبقى ${days} يوماً` : "منتهي المدة") : dateStr(lease.endDate)}
          />
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h3>بيانات العقد</h3></div>
            <div className="card-body">
              <dl className="dl">
                <dt>رقم العقد</dt><dd dir="ltr" style={{ textAlign: "right" }}>{lease.number}</dd>
                <dt>رقم إيجار</dt><dd dir="ltr" style={{ textAlign: "right" }}>{lease.ejarNumber ?? "— غير مسجل"}</dd>
                <dt>الفترة</dt><dd>{dateStr(lease.startDate)} — {dateStr(lease.endDate)}</dd>
                <dt>الوحدة</dt><dd><Link href={`/properties/${lease.unit.propertyId}`}>{lease.unit.property.name}</Link> — {lease.unit.code} ({label(UNIT_TYPES, lease.unit.type)})</dd>
                <dt>المالك</dt><dd><Link href={`/owners/${lease.unit.property.ownerId}`}>{lease.unit.property.owner.name}</Link></dd>
                <dt>المستأجر</dt><dd>{lease.tenant.name}{lease.tenant.phone ? ` · ${lease.tenant.phone}` : ""}</dd>
                <dt>التأمين المسترد</dt><dd>{money(lease.deposit)}</dd>
                <dt>ضريبة القيمة المضافة</dt><dd>{lease.vatRate ? `${lease.vatRate * 100}%` : "معفى"}</dd>
                <dt>تجديد تلقائي</dt><dd>{lease.autoRenew ? "نعم" : "لا"}</dd>
                {lease.notes ? (<><dt>ملاحظات</dt><dd>{lease.notes}</dd></>) : null}
              </dl>
            </div>
          </div>

          {can(s.role, "leases.edit") ? (
            <LeaseActions
              leaseId={lease.id}
              status={lease.status}
              endDate={lease.endDate.toISOString().slice(0, 10)}
              annualRent={lease.annualRent}
            />
          ) : null}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>جدول الدفعات</h2>
            <span className="badge info">{lease.invoices.length} فاتورة</span>
          </div>
          {lease.invoices.length === 0 ? <Empty msg="لا توجد فواتير." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الفاتورة</th><th>الفترة</th><th>الاستحقاق</th>
                    <th className="num">المبلغ</th><th className="num">الضريبة</th><th className="num">الإجمالي</th>
                    <th className="num">المحصّل</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {lease.invoices.map((i) => {
                    const isOverdue = ["UNPAID", "PARTIAL"].includes(i.status) && i.dueDate < new Date();
                    return (
                      <tr key={i.id}>
                        <td><Link href={`/invoices/${i.id}`} dir="ltr">{i.number}</Link></td>
                        <td className="sm">{i.period ?? "—"}</td>
                        <td className="sm nowrap">
                          {dateStr(i.dueDate)}
                          {isOverdue ? <span className="badge danger" style={{ marginRight: 6 }}>متأخرة</span> : null}
                        </td>
                        <td className="num">{money(i.amount)}</td>
                        <td className="num">{money(i.vatAmount)}</td>
                        <td className="num b">{money(i.total)}</td>
                        <td className="num">{money(i.paidTotal)}</td>
                        <td><Status value={i.status} label={label(INVOICE_STATUS, i.status)} /></td>
                      </tr>
                    );
                  })}
                  <tr className="tfoot">
                    <td colSpan={5}>الإجمالي</td>
                    <td className="num">{money(billed)}</td>
                    <td className="num">{money(paid)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
