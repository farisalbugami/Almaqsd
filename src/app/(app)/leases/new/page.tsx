import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { label, UNIT_TYPES } from "@/lib/labels";
import { PageHead } from "@/components/ui";
import { LeaseForm } from "../LeaseForm";
import { createLease } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLease({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  await requirePermission("leases.edit");
  const { unit } = await searchParams;

  const [units, tenants] = await Promise.all([
    db.unit.findMany({
      where: { status: { in: ["VACANT", "RESERVED"] } },
      include: { property: { select: { name: true, code: true } } },
      orderBy: [{ propertyId: "asc" }, { code: "asc" }],
    }),
    db.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);

  return (
    <>
      <PageHead title="عقد إيجار جديد" sub="سيولّد النظام جدول الفواتير آلياً" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 1000 }}>
          <LeaseForm
            action={createLease}
            presetUnitId={unit}
            units={units.map((u) => ({
              id: u.id,
              text: `${u.property.name} — ${u.code} (${label(UNIT_TYPES, u.type)})`,
              marketRent: u.marketRent,
              type: u.type,
            }))}
            tenants={tenants}
          />
        </div>
      </div>
    </>
  );
}
