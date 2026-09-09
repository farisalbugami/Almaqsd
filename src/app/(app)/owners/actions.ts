"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";

const OwnerSchema = z.object({
  code: z.string().min(1, "الرمز مطلوب"),
  name: z.string().min(2, "الاسم مطلوب"),
  type: z.enum(["INDIVIDUAL", "COMPANY", "REIT"]),
  idNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("بريد غير صحيح").optional().or(z.literal("")),
  iban: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
});

function parse(fd: FormData) {
  return OwnerSchema.safeParse({
    code: String(fd.get("code") ?? "").trim(),
    name: String(fd.get("name") ?? "").trim(),
    type: String(fd.get("type") ?? "INDIVIDUAL"),
    idNumber: String(fd.get("idNumber") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim(),
    iban: String(fd.get("iban") ?? "").trim(),
    bankName: String(fd.get("bankName") ?? "").trim(),
    notes: String(fd.get("notes") ?? "").trim(),
  });
}

export async function createOwner(_prev: unknown, fd: FormData) {
  const s = await requirePermission("owners.edit");
  const r = parse(fd);
  if (!r.success) return { error: r.error.issues[0].message };

  const exists = await db.owner.findUnique({ where: { code: r.data.code } });
  if (exists) return { error: "رمز المالك مستخدم مسبقاً" };

  const owner = await db.owner.create({ data: { ...r.data, email: r.data.email || null } });
  await logAction(s.userId, "CREATE", "Owner", owner.id, `إضافة مالك: ${owner.name}`);
  revalidatePath("/owners");
  redirect(`/owners/${owner.id}`);
}

export async function updateOwner(id: string, _prev: unknown, fd: FormData) {
  const s = await requirePermission("owners.edit");
  const r = parse(fd);
  if (!r.success) return { error: r.error.issues[0].message };

  await db.owner.update({ where: { id }, data: { ...r.data, email: r.data.email || null } });
  await logAction(s.userId, "UPDATE", "Owner", id, `تعديل مالك: ${r.data.name}`);
  revalidatePath(`/owners/${id}`);
  return { ok: "تم الحفظ" };
}
