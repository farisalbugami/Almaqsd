import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Mark } from "@/components/Mark";
import "../globals.css";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  if (s.role !== "OWNER") redirect("/");
  if (!s.ownerId) redirect("/denied");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "var(--ink)", color: "#f3ece4" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--gold)" }}><Mark size={26} /></span>
          <div>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 15, fontWeight: 600 }}>بوابة المالك — المقصد</div>
            <div style={{ fontSize: 11, color: "#a99e93" }}>{s.name}</div>
          </div>
          <div style={{ flex: 1 }} />
          <Link href="/portal" style={{ color: "#ded4c9", fontSize: 13 }}>الرئيسية</Link>
          <form action="/api/logout" method="post">
            <button className="btn sm" type="submit">خروج</button>
          </form>
        </div>
      </header>
      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: 24 }}>{children}</div>
      <footer style={{ background: "var(--surface-2)", borderTop: "1px solid var(--rule)", padding: "14px 24px", textAlign: "center" }}>
        <div className="sm mute">شركة المقصد لإدارة الأملاك والتسويق العقاري — بيانات محدّثة لحظياً من نظام التشغيل</div>
      </footer>
    </div>
  );
}
