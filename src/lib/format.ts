/** ISO timestamp -> local YYYY-MM-DD. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** 今天 / 昨天 / N 天前 for the last month, then the plain date. */
export function relDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  // round, not floor: a day across a DST change is 23 or 25 hours long.
  const days = Math.round(
    (startOfToday - new Date(d).setHours(0, 0, 0, 0)) / DAY,
  );
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return fmtDate(iso);
}
