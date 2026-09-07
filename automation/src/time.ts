/** أدوات الوقت — التوقيت المرجعي: الرياض (UTC+3، بلا توقيت صيفي) */

const RIYADH_OFFSET_HOURS = 3;

/** يحوّل تاريخًا ووقتًا بتوقيت الرياض إلى ISO بتوقيت UTC للتخزين */
export function riyadhToUtcIso(dateYmd: string, hhmm: string): string {
  const parts = dateYmd.split("-").map(Number);
  const [y, m, d] = [parts[0] ?? 1970, parts[1] ?? 1, parts[2] ?? 1];
  const timeParts = hhmm.split(":").map(Number);
  const [hh, mm] = [timeParts[0] ?? 0, timeParts[1] ?? 0];
  return new Date(Date.UTC(y, m - 1, d, hh - RIYADH_OFFSET_HOURS, mm, 0, 0)).toISOString();
}

/** صيغة عرض بتوقيت الرياض */
export function fmtRiyadh(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() + RIYADH_OFFSET_HOURS * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return `${days[local.getUTCDay()]} ${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(
    local.getUTCDate()
  )} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

/** أحد الأسبوع الذي يقع فيه التاريخ (بداية الأسبوع في السعودية) */
export function startOfSaudiWeek(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return addDays(copy, -copy.getUTCDay());
}

export function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
