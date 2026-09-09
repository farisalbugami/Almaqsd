import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/roles";
import { money, dateStr } from "@/lib/format";
import { label, OWNER_TYPES, LEASE_STATUS } from "@/lib/labels";
import { PageHead, Status, Empty } from "@/components/ui";
import { TenantForm } from "./TenantForm";
import { createTenant } from "./actions";

export const dynamic = "force-dynamic";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requirePermission("leases.view");
  const { q } = await searchParams;

  const tenants = await db.tenant.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { idNumber: { contains: q } }] } : {},
    include: { leases: { include: { unit: { include: { property: true } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHead title="المستأجرون" sub={`${tenants.length} مستأجراً`} />
      <div className="content stack">
        <form className="card card-body row" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="بحث بالاسم أو الرمز أو الهوية" style={{ maxWidth: 300 }} />
          <button className="btn" type="submit">بحث</button>
          {q ? <Link className="btn sm" href="/tenants">إلغاء</Link> : null}
        </form>

        <div className="card">
          {tenants.length === 0 ? <Empty msg="لا يوجد مستأجرون." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>الرمز</th><th>المستأجر</th><th>النوع</th><th>الجوال</th><th className="num">العقود</th><th>العقد الساري</th><th className="num">الإيجار السنوي</th></tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const active = t.leases.find((l) => l.status === "ACTIVE");
                    return (
                      <tr key={t.id}>
                        <td className="sm mute" dir="ltr">{t.code}</td>
                        <td className="b">{t.name}</td>
                        <td className="sm">{label(OWNER_TYPES, t.type)}</td>
                        <td className="sm mute" dir="ltr">{t.phone ?? "—"}</td>
                        <td className="num">{t.leases.length}</td>
                        <td className="sm">
                          {active ? (
                            <Link href={`/leases/${active.id}`}>
                              {active.unit.property.name} — {active.unit.code}
                            </Link>
                          ) : <Status value="EXPIRED" label="لا يوجد" />}
                        </td>
                        <td className="num nowrap">{active ? money(active.annualRent) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {can(s.role, "leases.edit") ? (
          <div className="card">
            <div className="card-head"><h3>إضافة مستأجر</h3></div>
            <div className="card-body"><TenantForm action={createTenant} /></div>
          </div>
        ) : null}
      </div>
    </>
  );
}
