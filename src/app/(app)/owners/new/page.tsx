import { requirePermission } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { OwnerForm } from "../OwnerForm";
import { createOwner } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOwner() {
  await requirePermission("owners.edit");
  return (
    <>
      <PageHead title="مالك جديد" sub="إضافة مالك أو مستثمر أو صندوق ريت" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 900 }}>
          <OwnerForm action={createOwner} submitLabel="حفظ المالك" />
        </div>
      </div>
    </>
  );
}
