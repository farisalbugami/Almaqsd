import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS, PERMISSIONS, type Role } from "@/lib/roles";
import { dateStr } from "@/lib/format";
import { PageHead, Empty } from "@/components/ui";
import { UserForm } from "./UserForm";
import { UserToggle } from "./UserToggle";
import { createUser } from "./actions";

export const dynamic = "force-dynamic";

const PERM_LABELS: Record<string, string> = {
  "owners.view": "عرض المُلاك", "owners.edit": "تعديل المُلاك",
  "properties.view": "عرض العقارات", "properties.edit": "تعديل العقارات",
  "leases.view": "عرض العقود", "leases.edit": "تعديل العقود",
  "invoices.view": "عرض الفواتير", "invoices.edit": "تعديل الفواتير",
  "payments.edit": "تسجيل التحصيل",
  "expenses.view": "عرض المصروفات", "expenses.edit": "تسجيل المصروفات",
  "payouts.view": "عرض التوريدات", "payouts.edit": "إدارة التوريدات",
  "documents.view": "عرض الوثائق", "documents.edit": "تعديل الوثائق",
  "users.manage": "إدارة المستخدمين", "audit.view": "سجل التدقيق",
  "portal.view": "بوابة المالك",
};

export default async function UsersPage() {
  const s = await requirePermission("users.manage");
  const [users, owners] = await Promise.all([
    db.user.findMany({ include: { owner: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.owner.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);

  const roles = Object.keys(ROLE_LABELS) as Role[];

  return (
    <>
      <PageHead title="المستخدمون والصلاحيات" sub={`${users.length} حساباً`} />
      <div className="content stack">
        <div className="card">
          <div className="card-head"><h2>الحسابات</h2></div>
          {users.length === 0 ? <Empty msg="لا يوجد مستخدمون." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>مرتبط بمالك</th><th>آخر دخول</th><th>الحالة</th><th /></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="b">{u.name}</td>
                      <td className="sm mute" dir="ltr">{u.email}</td>
                      <td className="sm">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                      <td className="sm">{u.owner?.name ?? "—"}</td>
                      <td className="sm nowrap">{u.lastLoginAt ? dateStr(u.lastLoginAt) : "لم يدخل بعد"}</td>
                      <td><span className={`badge ${u.active ? "ok" : "mute"}`}>{u.active ? "مفعّل" : "معطّل"}</span></td>
                      <td>{u.id !== s.userId ? <UserToggle id={u.id} active={u.active} /> : <span className="sm mute">حسابك</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h3>إضافة مستخدم</h3></div>
          <div className="card-body"><UserForm action={createUser} owners={owners} /></div>
        </div>

        <div className="card">
          <div className="card-head"><h2>مصفوفة الصلاحيات</h2></div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>الصلاحية</th>
                  {roles.map((r) => <th key={r} className="num">{ROLE_LABELS[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(PERMISSIONS).map(([perm, allowed]) => (
                  <tr key={perm}>
                    <td className="sm">{PERM_LABELS[perm] ?? perm}</td>
                    {roles.map((r) => (
                      <td key={r} className="num">
                        {(allowed as readonly string[]).includes(r)
                          ? <span style={{ color: "var(--ok)" }}>✓</span>
                          : <span className="mute">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
