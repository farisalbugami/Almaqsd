import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { DocumentForm } from "./DocumentForm";
import { createDocument } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDocument({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  await requirePermission("documents.edit");
  const { property } = await searchParams;
  const properties = await db.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHead title="وثيقة جديدة" sub="سينبّهك النظام قبل انتهائها بـ 60 يوماً" />
      <div className="content">
        <div className="card card-body" style={{ maxWidth: 900 }}>
          <DocumentForm action={createDocument} properties={properties} presetProperty={property} />
        </div>
      </div>
    </>
  );
}
