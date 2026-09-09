"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./Mark";

type Item = { href: string; label: string; icon: string; perm?: string };
type Group = { title: string; items: Item[] };

export function Nav({ groups, userName, roleLabel }: { groups: Group[]; userName: string; roleLabel: string }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/" && path.startsWith(href + "/")) || (href !== "/" && path === href);

  return (
    <aside className="side">
      <div className="side-brand">
        <Mark size={24} />
        <div>
          <b>منظومة المقصد</b>
          <span>إدارة الأملاك والتسويق العقاري</span>
        </div>
      </div>
      <nav>
        {groups.map((g) => (
          <div key={g.title} style={{ display: "contents" }}>
            <div className="grp">{g.title}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={active(it.href) ? "on" : ""}>
                <span className="ic">{it.icon}</span>
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <b>{userName}</b>
        {roleLabel}
        <form action="/api/logout" method="post" style={{ marginTop: 8 }}>
          <button className="btn sm" style={{ width: "100%" }} type="submit">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </aside>
  );
}
