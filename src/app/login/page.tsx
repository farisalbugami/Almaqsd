import { redirect } from "next/navigation";
import { authenticate, createSession, getSession, logAction } from "@/lib/auth";
import { Mark } from "@/components/Mark";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);
  if (!user) redirect("/login?e=1");
  await createSession({ userId: user.id, name: user.name, role: user.role, ownerId: user.ownerId });
  await logAction(user.id, "LOGIN", "User", user.id, `دخول ${user.name}`);
  redirect(user.role === "OWNER" ? "/portal" : "/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSession()) redirect("/");
  const { e } = await searchParams;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-2)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22, color: "var(--gold)" }}>
          <Mark size={40} />
          <h1 style={{ color: "var(--ink)", marginTop: 8 }}>منظومة المقصد</h1>
          <div className="sm mute">النظام الإداري والتشغيلي والمالي</div>
        </div>

        <form action={login} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {e ? <div className="err">بيانات الدخول غير صحيحة، أو الحساب غير مُفعّل.</div> : null}
          <label className="f">
            <span>البريد الإلكتروني</span>
            <input name="email" type="email" required autoComplete="username" dir="ltr" placeholder="name@almaqsd.co" />
          </label>
          <label className="f">
            <span>كلمة المرور</span>
            <input name="password" type="password" required autoComplete="current-password" dir="ltr" />
          </label>
          <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>
            دخول
          </button>
        </form>

        <div className="card" style={{ marginTop: 14, padding: 12, fontSize: 12 }}>
          <div className="b" style={{ marginBottom: 6 }}>حسابات تجريبية (كلمة المرور: 123456)</div>
          <div className="mute" dir="ltr" style={{ textAlign: "right", lineHeight: 2 }}>
            admin@almaqsd.co — مدير النظام<br />
            finance@almaqsd.co — الفريق المالي<br />
            ops@almaqsd.co — الفريق الإداري<br />
            owner@example.com — بوابة المالك
          </div>
        </div>
      </div>
    </div>
  );
}
