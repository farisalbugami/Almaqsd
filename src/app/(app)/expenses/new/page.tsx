import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { ExpenseForm } from "../ExpenseForm";
import { createExpense } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExpense({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  await requirePermission("expenses.edit");
  const { property } = await searchParams;
  const properties = await db.property.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, units: { select: { id: true, code: true }, orderBy: { code: "asc" } } },
  });

  return (
    <>
      <PageHead title="مصروف جديد" sub="سيظهر في كشف حساب المالك إن حُمّل عليه" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 1000 }}>
          <ExpenseForm action={createExpense} properties={properties} presetProperty={property} />
        </div>
      </div>
    </>
  );
}
