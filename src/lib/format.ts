export const SAR = "ر.س";

export function money(n: number | null | undefined, withCurrency = true) {
  const v = Number(n ?? 0);
  const s = v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withCurrency ? `${s} ${SAR}` : s;
}

export function moneyShort(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} مليون`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ألف`;
  return v.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

export function dateStr(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function dateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toLocaleString("ar-SA", { maximumFractionDigits: digits })}%`;
}

export function daysUntil(d: Date | string | null | undefined) {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
