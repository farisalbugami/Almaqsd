import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, moneyShort } from "@/lib/format";
import { label, OWNER_TYPES } from "@/lib/labels";
import { PageHead, Status, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OwnersPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const s = await requirePermission("owners.view");
  const { q, type } = await searchParams;

  const owners = await db.owner.findMany({
    where: {
      active: true,
      ...(type ? { type } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { idNumber: { contains: q } }] } : {}),
    },
    include: {
      properties: { select: { id: true, marketValue: true, units: { select: { status: true } } } },
      contracts: { where: { status: "ACTIVE" }, select: { commissionType: true, commissionRate: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHead
        title="المُلاك والمستثمرون"
        sub={`${owners.length} مالكاً — محور المنظومة`}
        actions={
          can(s.role, "owners.edit") ? (
            <Link className="btn primary" href="/owners/new">+ مالك جديد</Link>
          ) : null
        }
      />
      <div className="content stack">
        <form className="card card-body row" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="بحث بالاسم أو الرمز أو الهوية" style={{ maxWidth: 280 }} />
          <select name="type" defaultValue={type ?? ""} style={{ maxWidth: 170 }}>
            <option value="">كل التصنيفات</option>
            <option value="INDIVIDUAL">فرد</option>
            <option value="COMPANY">شركة</option>
            <option value="REIT">صندوق ريت</option>
          </select>
          <button className="btn" type="submit">تصفية</button>
          {q || type ? <Link className="btn sm" href="/owners">إلغاء</Link> : null}
        </form>

        <div className="card">
          {owners.length === 0 ? (
            <Empty msg="لا يوجد ملّاك مطابقون." />
          ) : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>المالك</th>
                    <th>التصنيف</th>
                    <th className="num">العقارات</th>
                    <th className="num">الوحدات</th>
                    <th className="num">قيمة المحفظة</th>
                    <th>عقد الإدارة</th>
                    <th>التواصل</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o) => {
                    const units = o.properties.flatMap((p) => p.units);
                    const leased = units.filter((u) => u.status === "LEASED").length;
                    const value = o.properties.reduce((s2, p) => s2 + (p.marketValue ?? 0), 0);
                    const c = o.contracts[0];
                    return (
                      <tr key={o.id}>
                        <td className="sm mute" dir="ltr">{o.code}</td>
                        <td><Link href={`/owners/${o.id}`} className="b">{o.name}</Link></td>
                        <td><Status value={o.type} label={label(OWNER_TYPES, o.type)} /></td>
                        <td className="num">{o.properties.length}</td>
                        <td className="num sm">{leased} / {units.length}</td>
                        <td className="num nowrap">{moneyShort(value)}</td>
                        <td className="sm">
                          {c ? (
                            c.commissionType === "FIXED_MONTHLY"
                              ? `${money(c.commissionRate)} شهرياً`
                              : `${c.commissionRate}%`
                          ) : (
                            <span className="badge mute">لا يوجد</span>
                          )}
                        </td>
                        <td className="sm mute" dir="ltr">{o.phone ?? "—"}</td>
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
