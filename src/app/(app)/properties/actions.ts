"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

const PropertySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  ownerId: z.string().min(1, "المالك مطلوب"),
  type: z.enum(["COMMERCIAL", "OFFICE", "RESIDENTIAL", "HOSPITALITY", "LAND"]),
  city: z.string().min(1, "المدينة مطلوبة"),
});

export async function createProperty(_p: unknown, fd: FormData) {
  const s = await requirePermission("properties.edit");
  const base = PropertySchema.safeParse({
    code: String(fd.get("code") ?? "").trim(),
    name: String(fd.get("name") ?? "").trim(),
    ownerId: String(fd.get("ownerId") ?? ""),
    type: String(fd.get("type") ?? "RESIDENTIAL"),
    city: String(fd.get("city") ?? "").trim(),
  });
  if (!base.success) return { error: base.error.issues[0].message };
  if (await db.property.findUnique({ where: { code: base.data.code } })) return { error: "رمز العقار مستخدم مسبقاً" };

  const p = await db.property.create({
    data: {
      ...base.data,
      district: String(fd.get("district") ?? "") || null,
      address: String(fd.get("address") ?? "") || null,
      deedNumber: String(fd.get("deedNumber") ?? "") || null,
      landArea: num(fd.get("landArea")),
      builtArea: num(fd.get("builtArea")),
      floors: num(fd.get("floors")),
      buildYear: num(fd.get("buildYear")),
      marketValue: num(fd.get("marketValue")),
      valuedAt: fd.get("valuedAt") ? new Date(String(fd.get("valuedAt"))) : null,
      notes: String(fd.get("notes") ?? "") || null,
    },
  });
  await logAction(s.userId, "CREATE", "Property", p.id, `إضافة عقار: ${p.name}`);
  revalidatePath("/properties");
  redirect(`/properties/${p.id}`);
}

export async function updateProperty(id: string, _p: unknown, fd: FormData) {
  const s = await requirePermission("properties.edit");
  const base = PropertySchema.safeParse({
    code: String(fd.get("code") ?? "").trim(),
    name: String(fd.get("name") ?? "").trim(),
    ownerId: String(fd.get("ownerId") ?? ""),
    type: String(fd.get("type") ?? "RESIDENTIAL"),
    city: String(fd.get("city") ?? "").trim(),
  });
  if (!base.success) return { error: base.error.issues[0].message };

  await db.property.update({
    where: { id },
    data: {
      ...base.data,
      district: String(fd.get("district") ?? "") || null,
      address: String(fd.get("address") ?? "") || null,
      deedNumber: String(fd.get("deedNumber") ?? "") || null,
      landArea: num(fd.get("landArea")),
      builtArea: num(fd.get("builtArea")),
      floors: num(fd.get("floors")),
      buildYear: num(fd.get("buildYear")),
      marketValue: num(fd.get("marketValue")),
      valuedAt: fd.get("valuedAt") ? new Date(String(fd.get("valuedAt"))) : null,
      status: String(fd.get("status") ?? "ACTIVE"),
      notes: String(fd.get("notes") ?? "") || null,
    },
  });
  await logAction(s.userId, "UPDATE", "Property", id, `تعديل عقار: ${base.data.name}`);
  revalidatePath(`/properties/${id}`);
  return { ok: "تم الحفظ" };
}

export async function createUnit(propertyId: string, _p: unknown, fd: FormData) {
  const s = await requirePermission("properties.edit");
  const code = String(fd.get("code") ?? "").trim();
  if (!code) return { error: "رمز الوحدة مطلوب" };
  if (await db.unit.findFirst({ where: { propertyId, code } })) return { error: "رمز الوحدة مكرر داخل هذا العقار" };

  const u = await db.unit.create({
    data: {
      propertyId,
      code,
      type: String(fd.get("type") ?? "APARTMENT"),
      floor: String(fd.get("floor") ?? "") || null,
      area: num(fd.get("area")),
      rooms: num(fd.get("rooms")),
      baths: num(fd.get("baths")),
      marketRent: num(fd.get("marketRent")),
      status: String(fd.get("status") ?? "VACANT"),
      meterElec: String(fd.get("meterElec") ?? "") || null,
      meterWater: String(fd.get("meterWater") ?? "") || null,
    },
  });
  await logAction(s.userId, "CREATE", "Unit", u.id, `إضافة وحدة ${code}`);
  revalidatePath(`/properties/${propertyId}`);
  return { ok: "تمت إضافة الوحدة" };
}

export async function setUnitStatus(unitId: string, status: string) {
  const s = await requirePermission("properties.edit");
  const u = await db.unit.update({ where: { id: unitId }, data: { status } });
  await logAction(s.userId, "UPDATE", "Unit", unitId, `تغيير حالة الوحدة ${u.code} إلى ${status}`);
  revalidatePath(`/properties/${u.propertyId}`);
}
