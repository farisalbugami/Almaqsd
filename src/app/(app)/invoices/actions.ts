"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";
import { nextNumber, round2 } from "@/lib/finance";

/** تسجيل سند قبض وتحديث حالة الفاتورة آلياً */
export async function recordPayment(invoiceId: string, _p: unknown, fd: FormData) {
  const s = await requirePermission("payments.edit");

  const amount = Number(fd.get("amount") ?? 0);
  const paidAt = new Date(String(fd.get("paidAt") ?? ""));
  if (!(amount > 0)) return { error: "المبلغ يجب أن يكون أكبر من صفر" };
  if (isNaN(paidAt.getTime())) return { error: "تاريخ السداد غير صحيح" };

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: "الفاتورة غير موجودة" };
  if (invoice.status === "CANCELLED") return { error: "لا يمكن تحصيل فاتورة ملغاة" };

  const remaining = round2(invoice.total - invoice.paidTotal);
  if (amount > remaining + 0.01) return { error: `المبلغ يتجاوز المتبقي (${remaining.toFixed(2)} ر.س)` };

  const number = await nextNumber("RCV", "payment");

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        number, invoiceId, paidAt, amount,
        method: String(fd.get("method") ?? "BANK_TRANSFER"),
        reference: String(fd.get("reference") ?? "") || null,
        bankName: String(fd.get("bankName") ?? "") || null,
        notes: String(fd.get("notes") ?? "") || null,
      },
    });
    const paidTotal = round2(invoice.paidTotal + amount);
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidTotal, status: paidTotal >= invoice.total - 0.01 ? "PAID" : "PARTIAL" },
    });
  });

  await logAction(s.userId, "CREATE", "Payment", invoiceId, `سند قبض ${number} بمبلغ ${amount} على ${invoice.number}`);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: `تم تسجيل سند القبض ${number}` };
}

export async function cancelInvoice(invoiceId: string) {
  const s = await requirePermission("invoices.edit");
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return;
  if (inv.payments.length > 0) return;
  await db.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
  await logAction(s.userId, "UPDATE", "Invoice", invoiceId, `إلغاء الفاتورة ${inv.number}`);
  revalidatePath(`/invoices/${invoiceId}`);
}
