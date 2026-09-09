import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHead, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, string> = {
  CREATE: "إنشاء", UPDATE: "تعديل", DELETE: "حذف", LOGIN: "دخول", LOGOUT: "خروج",
};

const TONES: Record<string, string> = {
  CREATE: "ok", UPDATE: "info", DELETE: "danger", LOGIN: "mute", LOGOUT: "mute",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requirePermission("audit.view");
  const { entity } = await searchParams;

  const logs = await db.auditLog.findMany({
    where: entity ? { entity } : {},
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return (
    <>
      <PageHead title="سجل التدقيق" sub={`آخر ${logs.length} حركة على النظام`} />
      <div className="content">
        <div className="card">
          {logs.length === 0 ? <Empty msg="السجل فارغ." /> : (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>التفصيل</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="sm nowrap" dir="ltr" style={{ textAlign: "right" }}>
                        {l.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="sm">{l.user?.name ?? "—"}</td>
                      <td><span className={`badge ${TONES[l.action] ?? "mute"}`}>{ACTIONS[l.action] ?? l.action}</span></td>
                      <td className="sm mute" dir="ltr">{l.entity}</td>
                      <td className="sm">{l.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
