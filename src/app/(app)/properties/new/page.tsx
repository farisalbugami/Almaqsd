import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { PropertyForm } from "../PropertyForm";
import { createProperty } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProperty() {
  await requirePermission("properties.edit");
  const owners = await db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  return (
    <>
      <PageHead title="عقار جديد" sub="تسجيل عقار وربطه بمالكه" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 1000 }}>
          <PropertyForm action={createProperty} owners={owners} submitLabel="حفظ العقار" />
        </div>
      </div>
    </>
  );
}
