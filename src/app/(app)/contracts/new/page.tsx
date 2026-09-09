import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { ContractForm } from "./ContractForm";
import { createContract } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContract({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  await requirePermission("owners.edit");
  const { owner } = await searchParams;
  const owners = await db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });

  return (
    <>
      <PageHead title="عقد إدارة جديد" sub="يحدد العمولة وسقف الصرف — أساس احتساب كشف حساب المالك" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 900 }}>
          <ContractForm action={createContract} owners={owners} presetOwner={owner} />
        </div>
      </div>
    </>
  );
}
