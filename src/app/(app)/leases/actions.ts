"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, logAction } from "@/lib/auth";
import { buildSchedule, nextNumber, round2 } from "@/lib/finance";

/** إنشاء عقد إيجار + توليد جدول الفواتير آلياً + تحديث حالة الوحدة */
export async function createLease(_p: unknown, fd: FormData) {
  const s = await requirePermission("leases.edit");

  const unitId = String(fd.get("unitId") ?? "");
  const tenantId = String(fd.get("tenantId") ?? "");
  const startDate = new Date(String(fd.get("startDate") ?? ""));
  const endDate = new Date(String(fd.get("endDate") ?? ""));
  const annualRent = Number(fd.get("annualRent") ?? 0);
  const installments = Number(fd.get("installments") ?? 1);
  const vatRate = Number(fd.get("vatRate") ?? 0) / 100;

  if (!unitId || !tenantId) return { error: "الوحدة والمستأجر مطلوبان" };
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { error: "التواريخ غير صحيحة" };
  if (endDate <= startDate) return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  if (annualRent <= 0) return { error: "الإيجار السنوي يجب أن يكون أكبر من صفر" };

  const clash = await db.lease.findFirst({
    where: { unitId, status: "ACTIVE", startDate: { lte: endDate }, endDate: { gte: startDate } },
  });
  if (clash) return { error: `تعارض مع العقد الساري ${clash.number} على نفس الوحدة` };

  const number = await nextNumber("LSE", "lease");
  const schedule = buildSchedule({ startDate, endDate, annualRent, installments, vatRate });

  const lease = await db.$transaction(async (tx) => {
    const l = await tx.lease.create({
      data: {
        number, unitId, tenantId, startDate, endDate, annualRent, installments, vatRate,
        deposit: Number(fd.get("deposit") ?? 0),
        ejarNumber: String(fd.get("ejarNumber") ?? "") || null,
        autoRenew: fd.get("autoRenew") === "on",
        status: "ACTIVE",
        notes: String(fd.get("notes") ?? "") || null,
      },
    });

    const year = new Date().getFullYear();
    const last = await tx.invoice.findFirst({
      where: { number: { startsWith: `INV-${year}-` } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let seq = last ? Number(String(last.number).split("-")[2]) + 1 : 1;

    for (const row of schedule) {
      await tx.invoice.create({
        data: {
          number: `INV-${year}-${String(seq++).padStart(4, "0")}`,
          leaseId: l.id,
          issueDate: row.issueDate,
          dueDate: row.dueDate,
          amount: row.amount,
          vatAmount: row.vatAmount,
          total: row.total,
          period: row.period,
        },
      });
    }

    await tx.unit.update({ where: { id: unitId }, data: { status: "LEASED" } });
    return l;
  });

  await logAction(s.userId, "CREATE", "Lease", lease.id, `إنشاء عقد ${number} بـ ${schedule.length} دفعة`);
  revalidatePath("/leases");
  revalidatePath("/invoices");
  redirect(`/leases/${lease.id}`);
}

export async function terminateLease(leaseId: string) {
  const s = await requirePermission("leases.edit");
  const lease = await db.lease.update({
    where: { id: leaseId },
    data: { status: "TERMINATED", terminationDate: new Date() },
  });
  await db.unit.update({ where: { id: lease.unitId }, data: { status: "VACANT" } });
  await db.invoice.updateMany({
    where: { leaseId, status: "UNPAID", dueDate: { gt: new Date() } },
    data: { status: "CANCELLED" },
  });
  await logAction(s.userId, "UPDATE", "Lease", leaseId, `فسخ العقد ${lease.number}`);
  revalidatePath(`/leases/${leaseId}`);
}

export async function renewLease(leaseId: string, _p: unknown, fd: FormData) {
  const s = await requirePermission("leases.edit");
  const old = await db.lease.findUnique({ where: { id: leaseId } });
  if (!old) return { error: "العقد غير موجود" };

  const startDate = new Date(String(fd.get("startDate") ?? ""));
  const endDate = new Date(String(fd.get("endDate") ?? ""));
  const annualRent = Number(fd.get("annualRent") ?? old.annualRent);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate)
    return { error: "تواريخ التجديد غير صحيحة" };

  const number = await nextNumber("LSE", "lease");
  const schedule = buildSchedule({ startDate, endDate, annualRent, installments: old.installments, vatRate: old.vatRate });

  const created = await db.$transaction(async (tx) => {
    await tx.lease.update({ where: { id: leaseId }, data: { status: "EXPIRED" } });
    const l = await tx.lease.create({
      data: {
        number, unitId: old.unitId, tenantId: old.tenantId, startDate, endDate, annualRent,
        installments: old.installments, deposit: old.deposit, vatRate: old.vatRate,
        autoRenew: old.autoRenew, status: "ACTIVE", notes: `تجديد للعقد ${old.number}`,
      },
    });
    const year = new Date().getFullYear();
    const last = await tx.invoice.findFirst({
      where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true },
    });
    let seq = last ? Number(String(last.number).split("-")[2]) + 1 : 1;
    for (const row of schedule) {
      await tx.invoice.create({
        data: {
          number: `INV-${year}-${String(seq++).padStart(4, "0")}`,
          leaseId: l.id, issueDate: row.issueDate, dueDate: row.dueDate,
          amount: row.amount, vatAmount: row.vatAmount, total: row.total, period: row.period,
        },
      });
    }
    return l;
  });

  await logAction(s.userId, "CREATE", "Lease", created.id, `تجديد ${old.number} إلى ${number}`);
  revalidatePath("/leases");
  redirect(`/leases/${created.id}`);
}
