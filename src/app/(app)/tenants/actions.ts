"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";

export async function createTenant(_p: unknown, fd: FormData) {
  const s = await requirePermission("leases.edit");
  const name = String(fd.get("name") ?? "").trim();
  const code = String(fd.get("code") ?? "").trim();
  if (!name) return { error: "اسم المستأجر مطلوب" };
  if (!code) return { error: "رمز المستأجر مطلوب" };
  if (await db.tenant.findUnique({ where: { code } })) return { error: "رمز المستأجر مستخدم مسبقاً" };

  const t = await db.tenant.create({
    data: {
      code,
      name,
      type: String(fd.get("type") ?? "INDIVIDUAL"),
      idNumber: String(fd.get("idNumber") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      email: String(fd.get("email") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    },
  });
  await logAction(s.userId, "CREATE", "Tenant", t.id, `إضافة مستأجر: ${t.name}`);
  revalidatePath("/tenants");
  return { ok: `تمت إضافة ${t.name}` };
}
