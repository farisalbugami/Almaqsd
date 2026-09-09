import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, moneyShort, dateStr, pct, daysUntil } from "@/lib/format";
import {
  label, PROPERTY_TYPES, UNIT_TYPES, UNIT_STATUS, EXPENSE_CATEGORIES,
  CHARGE_TO, DOCUMENT_TYPES, LEASE_STATUS,
} from "@/lib/labels";
import { PageHead, Kpi, Status, Empty } from "@/components/ui";
import { PropertyForm } from "../PropertyForm";
import { UnitForm } from "../UnitForm";
import { updateProperty, createUnit } from "../actions";

export const dynamic = "force-dynamic";

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const s = await requirePermission("properties.view");
  const { id } = await params;
  const { tab = "units" } = await searchParams;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      owner: true,
      units: {
        include: { leases: { where: { status: "ACTIVE" }, include: { tenant: true } } },
        orderBy: { code: "asc" },
      },
      expenses: { orderBy: { spentAt: "desc" }, take: 40 },
      documents: { orderBy: { expiryDate: "asc" } },
    },
  });
  if (!property) notFound();

  const owners = await db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });

  const leased = property.units.filter((u) => u.status === "LEASED").length;
  const actualRent = property.units.flatMap((u) => u.leases).reduce((a, l) => a + l.annualRent, 0);
  const potentialRent = property.units.reduce((a, u) => a + (u.marketRent ?? 0), 0);
  const expenseTotal = property.expenses.reduce((a, e) => a + e.amount + e.vatAmount, 0);

  const tabs = [
    { key: "units", label: `الوحدات (${property.units.length})` },
    { key: "expenses", label: `المصروفات (${property.expenses.length})` },
    { key: "documents", label: `الوثائق (${property.documents.length})` },
    ...(can(s.role, "properties.edit") ? [{ key: "edit", label: "بيانات العقار" }] : []),
  ];

  return (
    <>
      <PageHead
        title={property.name}
        sub={`${label(PROPERTY_TYPES, property.type)} · ${property.city}${property.district ? " — " + property.district : ""} · ${property.code}`}
        actions={<Link className="btn" href="/properties">رجوع</Link>}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="المالك" v={<Link href={`/owners/${property.ownerId}`} style={{ fontSize: "1rem" }}>{property.owner.name}</Link>} s={property.owner.code} />
          <Kpi k="الإشغال" v={pct(property.units.length ? leased / property.units.length : 0, 0)} s={`${leased} من ${property.units.length} وحدة`} />
          <Kpi k="الإيجار السنوي المتعاقد" v={moneyShort(actualRent)} s={`المستهدف ${moneyShort(potentialRent)}`} tone="accent" />
          <Kpi k="القيمة السوقية" v={moneyShort(property.marketValue)} s={property.valuedAt ? `آخر تقييم ${dateStr(property.valuedAt)}` : "لم يُقيَّم"} />
        </div>

        <div className="tabs">
          {tabs.map((t) => (
            <Link key={t.key} href={`/properties/${property.id}?tab=${t.key}`} className={tab === t.key ? "on" : ""}>{t.label}</Link>
          ))}
        </div>

        {tab === "units" ? (
          <div className="stack">
            <div className="card">
              <div className="card-head"><h2>الوحدات</h2></div>
              {property.units.length === 0 ? <Empty msg="لا توجد وحدات مسجلة في هذا العقار." /> : (
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>الرمز</th><th>النوع</th><th>الدور</th><th className="num">المساحة</th>
                        <th>الحالة</th><th>المستأجر الحالي</th><th className="num">الإيجار السنوي</th><th>ينتهي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {property.units.map((u) => {
                        const lease = u.leases[0];
                        return (
                          <tr key={u.id}>
                            <td className="b" dir="ltr">{u.code}</td>
                            <td className="sm">{label(UNIT_TYPES, u.type)}</td>
                            <td className="sm">{u.floor ?? "—"}</td>
                            <td className="num sm">{u.area ? `${u.area} م²` : "—"}</td>
                            <td><Status value={u.status} label={label(UNIT_STATUS, u.status)} /></td>
                            <td className="sm">{lease ? <Link href={`/leases/${lease.id}`}>{lease.tenant.name}</Link> : <span className="mute">—</span>}</td>
                            <td className="num nowrap">{lease ? money(lease.annualRent) : u.marketRent ? <span className="mute">{money(u.marketRent)}</span> : "—"}</td>
                            <td className="sm nowrap">{lease ? dateStr(lease.endDate) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {can(s.role, "properties.edit") ? (
              <div className="card">
                <div className="card-head"><h3>إضافة وحدة</h3></div>
                <div className="card-body">
                  <UnitForm action={createUnit.bind(null, property.id)} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "expenses" ? (
          <div className="card">
            <div className="card-head">
              <h2>المصروفات</h2>
              <span className="badge info">الإجمالي {money(expenseTotal)}</span>
              {can(s.role, "expenses.edit") ? <Link className="btn sm" href={`/expenses/new?property=${property.id}`}>+ مصروف</Link> : null}
            </div>
            {property.expenses.length === 0 ? <Empty msg="لا توجد مصروفات مسجلة." /> : (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>المورّد</th><th>التحميل</th><th className="num">المبلغ</th></tr>
                  </thead>
                  <tbody>
                    {property.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="sm mute" dir="ltr">{e.number}</td>
                        <td className="sm nowrap">{dateStr(e.spentAt)}</td>
                        <td className="sm">{e.description}</td>
                        <td className="sm">{label(EXPENSE_CATEGORIES, e.category)}</td>
                        <td className="sm">{e.vendor ?? "—"}</td>
                        <td><span className={`badge ${e.chargeTo === "OWNER" ? "gold" : "info"}`}>{label(CHARGE_TO, e.chargeTo)}</span></td>
                        <td className="num nowrap">{money(e.amount + e.vatAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === "documents" ? (
          <div className="card">
            <div className="card-head">
              <h2>الوثائق</h2>
              {can(s.role, "documents.edit") ? <Link className="btn sm" href={`/documents/new?property=${property.id}`}>+ وثيقة</Link> : null}
            </div>
            {property.documents.length === 0 ? <Empty msg="لا توجد وثائق مرتبطة بهذا العقار." /> : (
              <div className="tblwrap">
                <table>
                  <thead><tr><th>الوثيقة</th><th>النوع</th><th>الرقم</th><th>الإصدار</th><th>الانتهاء</th><th className="num">الحالة</th></tr></thead>
                  <tbody>
                    {property.documents.map((d) => {
                      const days = daysUntil(d.expiryDate);
                      return (
                        <tr key={d.id}>
                          <td>{d.title}</td>
                          <td className="sm">{label(DOCUMENT_TYPES, d.type)}</td>
                          <td className="sm mute" dir="ltr">{d.number ?? "—"}</td>
                          <td className="sm nowrap">{dateStr(d.issueDate)}</td>
                          <td className="sm nowrap">{dateStr(d.expiryDate)}</td>
                          <td className="num">
                            {days === null ? <span className="badge mute">بلا انتهاء</span>
                              : days < 0 ? <span className="badge danger">منتهية</span>
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
        ) : null}

        {tab === "edit" && can(s.role, "properties.edit") ? (
          <div className="card card-body" style={{ maxWidth: 1000 }}>
            <PropertyForm
              action={updateProperty.bind(null, property.id)}
              owners={owners}
              initial={property as unknown as Record<string, unknown>}
              submitLabel="حفظ التعديلات"
              showStatus
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
