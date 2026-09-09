"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";
import { nextNumber } from "@/lib/finance";

export async function createExpense(_p: unknown, fd: FormData) {
  const s = await requirePermission("expenses.edit");

  const propertyId = String(fd.get("propertyId") ?? "");
  const amount = Number(fd.get("amount") ?? 0);
  const spentAt = new Date(String(fd.get("spentAt") ?? ""));
  const description = String(fd.get("description") ?? "").trim();

  if (!propertyId) return { error: "العقار مطلوب" };
  if (!(amount > 0)) return { error: "المبلغ يجب أن يكون أكبر من صفر" };
  if (isNaN(spentAt.getTime())) return { error: "التاريخ غير صحيح" };
  if (!description) return { error: "البيان مطلوب" };

  const chargeTo = String(fd.get("chargeTo") ?? "OWNER");
  const vatAmount = Number(fd.get("vatAmount") ?? 0);

  // تحقق من سقف الصرف في عقد الإدارة عند التحميل على المالك
  let warning: string | undefined;
  if (chargeTo === "OWNER") {
    const property = await db.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } });
    if (property) {
      const contract = await db.managementContract.findFirst({
        where: { ownerId: property.ownerId, status: "ACTIVE" },
        select: { spendLimit: true, number: true },
      });
      if (contract && contract.spendLimit > 0 && amount + vatAmount > contract.spendLimit) {
        warning = `تنبيه: المبلغ يتجاوز سقف الصرف المتفق عليه في عقد الإدارة ${contract.number} — يلزم موافقة المالك.`;
      }
    }
  }

  const number = await nextNumber("EXP", "expense");
  const e = await db.expense.create({
    data: {
      number, propertyId,
      unitId: String(fd.get("unitId") ?? "") || null,
      category: String(fd.get("category") ?? "OTHER"),
      spentAt, amount, vatAmount,
      vendor: String(fd.get("vendor") ?? "") || null,
      chargeTo, description,
      status: warning ? "PENDING" : "APPROVED",
      attachment: String(fd.get("attachment") ?? "") || null,
    },
  });

  await logAction(s.userId, "CREATE", "Expense", e.id, `تسجيل مصروف ${number} بمبلغ ${amount}`);
  revalidatePath("/expenses");
  revalidatePath(`/properties/${propertyId}`);
  if (warning) return { ok: `تم الحفظ كمسودة معلّقة. ${warning}` };
  redirect("/expenses");
}

export async function setExpenseStatus(id: string, status: string) {
  const s = await requirePermission("expenses.edit");
  const e = await db.expense.update({ where: { id }, data: { status } });
  await logAction(s.userId, "UPDATE", "Expense", id, `تغيير حالة المصروف ${e.number} إلى ${status}`);
  revalidatePath("/expenses");
}
