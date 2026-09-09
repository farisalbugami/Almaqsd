"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";
import { nextNumber, ownerStatement } from "@/lib/finance";

/** يولّد توريداً من كشف الحساب المحتسب آلياً للفترة */
export async function generatePayout(_p: unknown, fd: FormData) {
  const s = await requirePermission("payouts.edit");
  const ownerId = String(fd.get("ownerId") ?? "");
  const from = new Date(String(fd.get("from") ?? ""));
  const to = new Date(String(fd.get("to") ?? ""));

  if (!ownerId) return { error: "المالك مطلوب" };
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return { error: "الفترة غير صحيحة" };
  to.setHours(23, 59, 59, 999);

  const dup = await db.payout.findFirst({ where: { ownerId, periodFrom: from, periodTo: to } });
  if (dup) return { error: `يوجد توريد لهذه الفترة بالفعل (${dup.number})` };

  const st = await ownerStatement(ownerId, from, to);
  if (st.collected === 0 && st.expenseTotal === 0) return { error: "لا توجد حركة مالية في هذه الفترة" };

  const number = await nextNumber("PAY", "payout");
  const p = await db.payout.create({
    data: {
      number, ownerId, periodFrom: from, periodTo: to,
      collected: st.collected, expenses: st.expenseTotal,
      commission: st.commission, netAmount: st.net, status: "DRAFT",
    },
  });
  await logAction(s.userId, "CREATE", "Payout", p.id, `توريد ${number} بصافي ${st.net}`);
  revalidatePath("/payouts");
  return { ok: `تم إنشاء التوريد ${number} بصافي ${st.net.toLocaleString("ar-SA")} ر.س` };
}

export async function markPayout(id: string, status: string, reference?: string) {
  const s = await requirePermission("payouts.edit");
  const p = await db.payout.update({
    where: { id },
    data: { status, paidAt: status === "PAID" ? new Date() : null, reference: reference ?? undefined },
  });
  await logAction(s.userId, "UPDATE", "Payout", id, `تحديث التوريد ${p.number} إلى ${status}`);
  revalidatePath("/payouts");
}
