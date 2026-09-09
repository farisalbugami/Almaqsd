import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, dateStr } from "@/lib/format";
import { label, INVOICE_STATUS, PAYMENT_METHODS } from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { PaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission("invoices.view");
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      lease: { include: { tenant: true, unit: { include: { property: { include: { owner: true } } } } } },
    },
  });
  if (!invoice) notFound();

  const remaining = invoice.total - invoice.paidTotal;
  const late = ["UNPAID", "PARTIAL"].includes(invoice.status) && invoice.dueDate < new Date();

  return (
    <>
      <PageHead
        title={`فاتورة ${invoice.number}`}
        sub={`${invoice.lease.tenant.name} · ${invoice.lease.unit.property.name} — ${invoice.lease.unit.code}`}
        actions={<Link className="btn" href="/invoices">رجوع</Link>}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="إجمالي الفاتورة" v={money(invoice.total)} s={`المبلغ ${money(invoice.amount)} + ضريبة ${money(invoice.vatAmount)}`} />
          <Kpi k="المحصّل" v={money(invoice.paidTotal)} s={`${invoice.payments.length} سند قبض`} />
          <Kpi k="المتبقي" v={money(remaining)} tone={remaining > 0 ? "alert" : undefined} />
          <Kpi
            k="الحالة"
            v={<Status value={invoice.status} label={label(INVOICE_STATUS, invoice.status)} />}
            s={late ? `متأخرة منذ ${dateStr(invoice.dueDate)}` : `الاستحقاق ${dateStr(invoice.dueDate)}`}
          />
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h3>بيانات الفاتورة</h3></div>
            <div className="card-body">
              <dl className="dl">
                <dt>رقم الفاتورة</dt><dd dir="ltr" style={{ textAlign: "right" }}>{invoice.number}</dd>
                <dt>العقد</dt><dd><Link href={`/leases/${invoice.leaseId}`}>{invoice.lease.number}</Link></dd>
                <dt>الفترة</dt><dd>{invoice.period ?? "—"}</dd>
                <dt>تاريخ الإصدار</dt><dd>{dateStr(invoice.issueDate)}</dd>
                <dt>تاريخ الاستحقاق</dt><dd>{dateStr(invoice.dueDate)}</dd>
                <dt>المستأجر</dt><dd>{invoice.lease.tenant.name}</dd>
                <dt>المالك</dt><dd><Link href={`/owners/${invoice.lease.unit.property.ownerId}`}>{invoice.lease.unit.property.owner.name}</Link></dd>
              </dl>
            </div>
          </div>

          {can(s.role, "payments.edit") && remaining > 0 && invoice.status !== "CANCELLED" ? (
            <div className="card">
              <div className="card-head"><h3>تسجيل سند قبض</h3></div>
              <div className="card-body">
                <PaymentForm invoiceId={invoice.id} remaining={remaining} />
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><h3>التحصيل</h3></div>
              <div className="empty">
                {invoice.status === "CANCELLED" ? "الفاتورة ملغاة." : remaining <= 0 ? "الفاتورة محصّلة بالكامل." : "لا تملك صلاحية التحصيل."}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>سندات القبض</h2></div>
          {invoice.payments.length === 0 ? <Empty msg="لم يُسجَّل أي سند قبض على هذه الفاتورة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>رقم السند</th><th>التاريخ</th><th>الطريقة</th><th>المرجع</th><th>البنك</th><th className="num">المبلغ</th></tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td dir="ltr" className="b">{p.number}</td>
                      <td className="sm nowrap">{dateStr(p.paidAt)}</td>
                      <td className="sm">{label(PAYMENT_METHODS, p.method)}</td>
                      <td className="sm mute" dir="ltr">{p.reference ?? "—"}</td>
                      <td className="sm">{p.bankName ?? "—"}</td>
                      <td className="num">{money(p.amount)}</td>
                    </tr>
                  ))}
                  <tr className="tfoot"><td colSpan={5}>الإجمالي المحصّل</td><td className="num">{money(invoice.paidTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
