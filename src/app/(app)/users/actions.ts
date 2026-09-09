"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, hashPassword, logAction } from "@/lib/auth";

export async function createUser(_p: unknown, fd: FormData) {
  const s = await requirePermission("users.manage");
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role") ?? "OPERATIONS");
  const ownerId = String(fd.get("ownerId") ?? "") || null;

  if (!name || !email) return { error: "الاسم والبريد مطلوبان" };
  if (password.length < 6) return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  if (role === "OWNER" && !ownerId) return { error: "حساب المالك يجب ربطه بمالك مسجل" };
  if (await db.user.findUnique({ where: { email } })) return { error: "البريد مستخدم مسبقاً" };

  const u = await db.user.create({
    data: {
      name, email, role, ownerId,
      passwordHash: await hashPassword(password),
      phone: String(fd.get("phone") ?? "") || null,
    },
  });
  await logAction(s.userId, "CREATE", "User", u.id, `إنشاء مستخدم: ${name} (${role})`);
  revalidatePath("/users");
  return { ok: `تم إنشاء حساب ${name}` };
}

export async function toggleUser(id: string, active: boolean) {
  const s = await requirePermission("users.manage");
  if (id === s.userId) return;
  const u = await db.user.update({ where: { id }, data: { active } });
  await logAction(s.userId, "UPDATE", "User", id, `${active ? "تفعيل" : "تعطيل"} حساب ${u.name}`);
  revalidatePath("/users");
}

export async function resetPassword(id: string, _p: unknown, fd: FormData) {
  const s = await requirePermission("users.manage");
  const password = String(fd.get("password") ?? "");
  if (password.length < 6) return { error: "كلمة المرور قصيرة" };
  const u = await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await logAction(s.userId, "UPDATE", "User", id, `إعادة تعيين كلمة مرور ${u.name}`);
  return { ok: "تم تغيير كلمة المرور" };
}
