import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { dateStr, daysUntil } from "@/lib/format";
import { label, DOCUMENT_TYPES, ENTITY_TYPES } from "@/lib/labels";
import { PageHead, Kpi, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const s = await requirePermission("documents.view");
  const { filter } = await searchParams;
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const where =
    filter === "expiring" ? { expiryDate: { gte: now, lte: in60 } }
    : filter === "expired" ? { expiryDate: { lt: now } }
    : {};

  const [documents, counts] = await Promise.all([
    db.document.findMany({ where, include: { property: true }, orderBy: [{ expiryDate: "asc" }] }),
    db.document.findMany({ select: { expiryDate: true } }),
  ]);

  const expiring = counts.filter((d) => d.expiryDate && d.expiryDate >= now && d.expiryDate <= in60).length;
  const expired = counts.filter((d) => d.expiryDate && d.expiryDate < now).length;

  const filters = [
    { k: "", l: "الكل" }, { k: "expiring", l: `تنتهي قريباً (${expiring})` }, { k: "expired", l: `منتهية (${expired})` },
  ];

  return (
    <>
      <PageHead
        title="الوثائق والتنبيهات"
        sub={`${counts.length} وثيقة مسجلة`}
        actions={can(s.role, "documents.edit") ? <Link className="btn primary" href="/documents/new">+ وثيقة</Link> : null}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="إجمالي الوثائق" v={counts.length} />
          <Kpi k="تنتهي خلال 60 يوماً" v={expiring} tone={expiring > 0 ? "alert" : undefined} s="تحتاج تجديداً" />
          <Kpi k="منتهية" v={expired} tone={expired > 0 ? "alert" : undefined} s="مخالفة نظامية محتملة" />
        </div>

        <div className="card card-body">
          <div className="tabs" style={{ border: 0 }}>
            {filters.map((f) => (
              <Link key={f.k} href={f.k ? `/documents?filter=${f.k}` : "/documents"} className={(filter ?? "") === f.k ? "on" : ""}>{f.l}</Link>
            ))}
          </div>
        </div>

        <div className="card">
          {documents.length === 0 ? <Empty msg="لا توجد وثائق مطابقة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>الوثيقة</th><th>النوع</th><th>مرتبطة بـ</th><th>الرقم</th><th>الإصدار</th><th>الانتهاء</th><th className="num">الحالة</th></tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const days = daysUntil(d.expiryDate);
                    return (
                      <tr key={d.id}>
                        <td className="b">{d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.title}</a> : d.title}</td>
                        <td className="sm">{label(DOCUMENT_TYPES, d.type)}</td>
                        <td className="sm">
                          {d.property ? <Link href={`/properties/${d.propertyId}`}>{d.property.name}</Link> : label(ENTITY_TYPES, d.entityType)}
                        </td>
                        <td className="sm mute" dir="ltr">{d.number ?? "—"}</td>
                        <td className="sm nowrap">{dateStr(d.issueDate)}</td>
                        <td className="sm nowrap">{dateStr(d.expiryDate)}</td>
                        <td className="num">
                          {days === null ? <span className="badge mute">بلا انتهاء</span>
                            : days < 0 ? <span className="badge danger">منتهية منذ {Math.abs(days)} يوم</span>
                            : days <= 30 ? <span className="badge danger">{days} يوم</span>
                            : days <= 60 ? <span className="badge warn">{days} يوم</span>
                            : <span className="badge ok">سارية</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
