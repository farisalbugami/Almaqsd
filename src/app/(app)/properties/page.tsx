import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { moneyShort } from "@/lib/format";
import { label, PROPERTY_TYPES } from "@/lib/labels";
import { PageHead, Empty, Kpi } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; owner?: string }> }) {
  const s = await requirePermission("properties.view");
  const { q, type, owner } = await searchParams;

  const [properties, owners] = await Promise.all([
    db.property.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(owner ? { ownerId: owner } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { city: { contains: q } }] } : {}),
      },
      include: { owner: true, units: { select: { status: true, marketRent: true } } },
      orderBy: { name: "asc" },
    }),
    db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const allUnits = properties.flatMap((p) => p.units);
  const leased = allUnits.filter((u) => u.status === "LEASED").length;
  const totalValue = properties.reduce((a, p) => a + (p.marketValue ?? 0), 0);
  const potentialRent = allUnits.reduce((a, u) => a + (u.marketRent ?? 0), 0);

  return (
    <>
      <PageHead
        title="العقارات والوحدات"
        sub={`${properties.length} عقاراً · ${allUnits.length} وحدة`}
        actions={can(s.role, "properties.edit") ? <Link className="btn primary" href="/properties/new">+ عقار جديد</Link> : null}
      />
      <div className="content stack">
        <div className="grid g4">
          <Kpi k="إجمالي القيمة السوقية" v={moneyShort(totalValue)} tone="accent" />
          <Kpi k="الوحدات المؤجرة" v={`${leased} / ${allUnits.length}`} />
          <Kpi k="الإيجار السنوي المستهدف" v={moneyShort(potentialRent)} s="لو أُجّرت كل الوحدات" />
          <Kpi k="الوحدات الشاغرة" v={allUnits.filter((u) => u.status === "VACANT").length} s="فرصة تأجير" />
        </div>

        <form className="card card-body row" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="بحث بالاسم أو الرمز أو المدينة" style={{ maxWidth: 260 }} />
          <select name="type" defaultValue={type ?? ""} style={{ maxWidth: 160 }}>
            <option value="">كل الأنواع</option>
            {Object.entries(PROPERTY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select name="owner" defaultValue={owner ?? ""} style={{ maxWidth: 200 }}>
            <option value="">كل المُلاك</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn" type="submit">تصفية</button>
          {q || type || owner ? <Link className="btn sm" href="/properties">إلغاء</Link> : null}
        </form>

        <div className="card">
          {properties.length === 0 ? <Empty msg="لا توجد عقارات مطابقة." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرمز</th><th>العقار</th><th>المالك</th><th>النوع</th><th>المدينة</th>
                    <th className="num">الوحدات</th><th className="num">الإشغال</th><th className="num">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p) => {
                    const l = p.units.filter((u) => u.status === "LEASED").length;
                    const r = p.units.length ? l / p.units.length : 0;
                    return (
                      <tr key={p.id}>
                        <td className="sm mute" dir="ltr">{p.code}</td>
                        <td><Link href={`/properties/${p.id}`} className="b">{p.name}</Link></td>
                        <td className="sm"><Link href={`/owners/${p.ownerId}`}>{p.owner.name}</Link></td>
                        <td className="sm">{label(PROPERTY_TYPES, p.type)}</td>
                        <td className="sm">{p.city}</td>
                        <td className="num">{p.units.length}</td>
                        <td className="num" style={{ minWidth: 92 }}>
                          <div className="sm">{l} ({Math.round(r * 100)}%)</div>
                          <div className="bar"><i style={{ width: `${r * 100}%` }} /></div>
                        </td>
                        <td className="num nowrap">{moneyShort(p.marketValue)}</td>
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
