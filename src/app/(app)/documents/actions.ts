"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";

export async function createDocument(_p: unknown, fd: FormData) {
  const s = await requirePermission("documents.edit");
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "عنوان الوثيقة مطلوب" };

  const propertyId = String(fd.get("propertyId") ?? "") || null;
  const d = await db.document.create({
    data: {
      title,
      type: String(fd.get("type") ?? "OTHER"),
      entityType: propertyId ? "PROPERTY" : String(fd.get("entityType") ?? "COMPANY"),
      entityId: propertyId,
      propertyId,
      number: String(fd.get("number") ?? "") || null,
      issueDate: fd.get("issueDate") ? new Date(String(fd.get("issueDate"))) : null,
      expiryDate: fd.get("expiryDate") ? new Date(String(fd.get("expiryDate"))) : null,
      fileUrl: String(fd.get("fileUrl") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    },
  });
  await logAction(s.userId, "CREATE", "Document", d.id, `إضافة وثيقة: ${title}`);
  revalidatePath("/documents");
  redirect("/documents");
}

export async function deleteDocument(id: string) {
  const s = await requirePermission("documents.edit");
  const d = await db.document.delete({ where: { id } });
  await logAction(s.userId, "DELETE", "Document", id, `حذف وثيقة: ${d.title}`);
  revalidatePath("/documents");
}
