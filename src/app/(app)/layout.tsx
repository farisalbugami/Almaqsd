import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, ROLE_LABELS, type Role, type Permission } from "@/lib/roles";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

const NAV: { title: string; items: { href: string; label: string; icon: string; perm: Permission }[] }[] = [
  {
    title: "الرئيسية",
    items: [{ href: "/", label: "لوحة المعلومات", icon: "▤", perm: "properties.view" }],
  },
  {
    title: "المُلاك والأصول",
    items: [
      { href: "/owners", label: "المُلاك والمستثمرون", icon: "◈", perm: "owners.view" },
      { href: "/contracts", label: "عقود الإدارة", icon: "❐", perm: "owners.view" },
      { href: "/properties", label: "العقارات والوحدات", icon: "⌂", perm: "properties.view" },
      { href: "/payouts", label: "توريدات المُلاك", icon: "⇄", perm: "payouts.view" },
    ],
  },
  {
    title: "التشغيل",
    items: [
      { href: "/tenants", label: "المستأجرون", icon: "☖", perm: "leases.view" },
      { href: "/leases", label: "عقود الإيجار", icon: "✎", perm: "leases.view" },
    ],
  },
  {
    title: "المالية",
    items: [
      { href: "/invoices", label: "الفواتير والتحصيل", icon: "₪", perm: "invoices.view" },
      { href: "/expenses", label: "المصروفات", icon: "−", perm: "expenses.view" },
    ],
  },
  {
    title: "الإداري",
    items: [
      { href: "/documents", label: "الوثائق والتنبيهات", icon: "▢", perm: "documents.view" },
      { href: "/users", label: "المستخدمون والصلاحيات", icon: "◉", perm: "users.manage" },
      { href: "/audit", label: "سجل التدقيق", icon: "⟳", perm: "audit.view" },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.role === "OWNER") redirect("/portal");

  const groups = NAV.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => can(session.role, i.perm)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="shell">
      <Nav
        groups={groups}
        userName={session.name}
        roleLabel={ROLE_LABELS[session.role as Role] ?? session.role}
      />
      <div className="main">{children}</div>
    </div>
  );
}
