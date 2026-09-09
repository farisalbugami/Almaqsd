"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";
import { nextNumber } from "@/lib/finance";

export async function createContract(_p: unknown, fd: FormData) {
  const s = await requirePermission("owners.edit");
  const ownerId = String(fd.get("ownerId") ?? "");
  const startDate = new Date(String(fd.get("startDate") ?? ""));
  const endDate = new Date(String(fd.get("endDate") ?? ""));
  const commissionRate = Number(fd.get("commissionRate") ?? 0);

  if (!ownerId) return { error: "المالك مطلوب" };
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate)
    return { error: "التواريخ غير صحيحة" };
  if (!(commissionRate > 0)) return { error: "قيمة العمولة مطلوبة" };

  const status = String(fd.get("status") ?? "ACTIVE");
  if (status === "ACTIVE") {
    const existing = await db.managementContract.findFirst({ where: { ownerId, status: "ACTIVE" } });
    if (existing) return { error: `يوجد عقد إدارة ساري لهذا المالك (${existing.number}). أنهِه أولاً.` };
  }

  const number = await nextNumber("MGT", "managementContract");
  const c = await db.managementContract.create({
    data: {
      number, ownerId, startDate, endDate,
      commissionType: String(fd.get("commissionType") ?? "PERCENT_COLLECTED"),
      commissionRate,
      spendLimit: Number(fd.get("spendLimit") ?? 0),
      scope: String(fd.get("scope") ?? "") || null,
      status,
    },
  });
  await logAction(s.userId, "CREATE", "ManagementContract", c.id, `عقد إدارة ${number}`);
  revalidatePath("/contracts");
  redirect(`/owners/${ownerId}?tab=contracts`);
}

export async function setContractStatus(id: string, status: string) {
  const s = await requirePermission("owners.edit");
  const c = await db.managementContract.update({ where: { id }, data: { status } });
  await logAction(s.userId, "UPDATE", "ManagementContract", id, `تغيير حالة ${c.number} إلى ${status}`);
  revalidatePath("/contracts");
}
