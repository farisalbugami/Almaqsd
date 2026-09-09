import "server-only";
import { db } from "./db";

/** توليد رقم تسلسلي بصيغة PREFIX-YYYY-NNNN */
export async function nextNumber(
  prefix: string,
  model: "invoice" | "payment" | "expense" | "payout" | "lease" | "managementContract",
) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-`;
  // @ts-expect-error فهرسة ديناميكية على نماذج Prisma
  const last = await db[model].findFirst({
    where: { number: { startsWith: like } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(String(last.number).split("-")[2]) + 1 : 1;
  return `${like}${String(seq).padStart(4, "0")}`;
}

/** جدول دفعات عقد الإيجار: يقسّم الإيجار السنوي على عدد الدفعات */
export function buildSchedule(opts: {
  startDate: Date;
  endDate: Date;
  annualRent: number;
  installments: number;
  vatRate: number;
}) {
  const { startDate, endDate, annualRent, installments, vatRate } = opts;
  const months = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (30.44 * 86_400_000)),
  );
  const years = months / 12;
  const totalRent = annualRent * years;
  const count = Math.max(1, Math.round(installments * years));
  const per = totalRent / count;
  const gapMonths = months / count;

  return Array.from({ length: count }, (_, i) => {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + Math.round(gapMonths * i));
    const amount = round2(per);
    const vatAmount = round2(amount * vatRate);
    return {
      issueDate: due,
      dueDate: due,
      amount,
      vatAmount,
      total: round2(amount + vatAmount),
      period: `الدفعة ${i + 1} من ${count}`,
    };
  });
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type StatementLine = {
  collected: number;
  expenses: number;
  commission: number;
  net: number;
};

/**
 * كشف حساب المالك عن فترة:
 * المحصّل فعلياً − المصروفات المحمّلة على المالك − عمولة الإدارة = صافي التوريد
 */
export async function ownerStatement(ownerId: string, from: Date, to: Date) {
  const properties = await db.property.findMany({
    where: { ownerId },
    select: { id: true, code: true, name: true },
  });
  const propertyIds = properties.map((p) => p.id);

  const payments = await db.payment.findMany({
    where: {
      paidAt: { gte: from, lte: to },
      invoice: { lease: { unit: { propertyId: { in: propertyIds } } } },
    },
    include: {
      invoice: {
        include: {
          lease: { include: { unit: { select: { propertyId: true, code: true } }, tenant: true } },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const expenses = await db.expense.findMany({
    where: {
      propertyId: { in: propertyIds },
      spentAt: { gte: from, lte: to },
      chargeTo: "OWNER",
      status: "APPROVED",
    },
    orderBy: { spentAt: "asc" },
  });

  const contract = await db.managementContract.findFirst({
    where: { ownerId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });

  const collected = round2(payments.reduce((s, p) => s + p.amount, 0));
  const expenseTotal = round2(expenses.reduce((s, e) => s + e.amount + e.vatAmount, 0));

  let commission = 0;
  if (contract) {
    if (contract.commissionType === "PERCENT_COLLECTED") {
      commission = round2(collected * (contract.commissionRate / 100));
    } else if (contract.commissionType === "PERCENT_CONTRACTED") {
      const leases = await db.lease.findMany({
        where: { status: "ACTIVE", unit: { propertyId: { in: propertyIds } } },
        select: { annualRent: true },
      });
      const contracted = leases.reduce((s, l) => s + l.annualRent, 0);
      const monthsInPeriod = Math.max(1, (to.getTime() - from.getTime()) / (30.44 * 86_400_000));
      commission = round2((contracted / 12) * monthsInPeriod * (contract.commissionRate / 100));
    } else {
      const monthsInPeriod = Math.max(1, Math.round((to.getTime() - from.getTime()) / (30.44 * 86_400_000)));
      commission = round2(contract.commissionRate * monthsInPeriod);
    }
  }

  const net = round2(collected - expenseTotal - commission);

  // تجميع حسب العقار
  const byProperty = properties.map((p) => {
    const c = round2(
      payments.filter((x) => x.invoice.lease.unit.propertyId === p.id).reduce((s, x) => s + x.amount, 0),
    );
    const e = round2(
      expenses.filter((x) => x.propertyId === p.id).reduce((s, x) => s + x.amount + x.vatAmount, 0),
    );
    return { property: p, collected: c, expenses: e, net: round2(c - e) };
  });

  return { contract, payments, expenses, collected, expenseTotal, commission, net, byProperty, properties };
}

/** مؤشرات لوحة المعلومات */
export async function dashboardMetrics() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const [units, leasedUnits, owners, properties, invoices, ytdPayments, expiring, overdueInv, marketValue] =
    await Promise.all([
      db.unit.count(),
      db.unit.count({ where: { status: "LEASED" } }),
      db.owner.count({ where: { active: true } }),
      db.property.count(),
      db.invoice.aggregate({ _sum: { total: true, paidTotal: true }, where: { status: { not: "CANCELLED" } } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: yearStart } } }),
      db.lease.count({ where: { status: "ACTIVE", endDate: { lte: in60, gte: now } } }),
      db.invoice.findMany({
        where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } },
        select: { total: true, paidTotal: true },
      }),
      db.property.aggregate({ _sum: { marketValue: true } }),
    ]);

  const billed = invoices._sum.total ?? 0;
  const paid = invoices._sum.paidTotal ?? 0;
  const overdue = round2(overdueInv.reduce((s, i) => s + (i.total - i.paidTotal), 0));

  return {
    units,
    leasedUnits,
    occupancy: units ? leasedUnits / units : 0,
    owners,
    properties,
    billed: round2(billed),
    paid: round2(paid),
    collectionRate: billed ? paid / billed : 0,
    ytdCollected: round2(ytdPayments._sum.amount ?? 0),
    expiringLeases: expiring,
    overdue,
    overdueCount: overdueInv.length,
    assetsUnderManagement: round2(marketValue._sum.marketValue ?? 0),
  };
}
