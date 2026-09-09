import Link from "next/link";
import { money } from "@/lib/format";

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export function Kpi({
  k,
  v,
  s,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  s?: React.ReactNode;
  tone?: "accent" | "alert";
}) {
  return (
    <div className={`kpi${tone ? " " + tone : ""}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

export function Money({ n, bold }: { n: number | null | undefined; bold?: boolean }) {
  return <span className={bold ? "b" : ""} style={{ fontVariantNumeric: "tabular-nums" }}>{money(n)}</span>;
}

const TONES: Record<string, string> = {
  ACTIVE: "ok", PAID: "ok", APPROVED: "ok", LEASED: "ok",
  UNPAID: "warn", PARTIAL: "warn", RESERVED: "warn", DRAFT: "mute", PENDING: "warn",
  VACANT: "info", MAINTENANCE: "warn", UNDER_MAINTENANCE: "warn",
  EXPIRED: "danger", TERMINATED: "danger", CANCELLED: "danger", REJECTED: "danger", OVERDUE: "danger",
  INACTIVE: "mute", REIT: "gold", COMPANY: "info", INDIVIDUAL: "mute",
};

export function Status({ value, label }: { value: string; label: string }) {
  return <span className={`badge ${TONES[value] ?? "mute"}`}>{label}</span>;
}

export function Empty({ msg, action }: { msg: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div>{msg}</div>
      {action ? <div style={{ marginTop: 10 }}>{action}</div> : null}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <div className="tabs">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.href === current ? "on" : ""}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
