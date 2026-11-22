import { MESSAGES, type Locale } from "./messages";

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
export function relDate(iso: string, locale: Locale = "zh"): string {
  const t = MESSAGES[locale];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  // round, not floor: a day across a DST change is 23 or 25 hours long.
  const days = Math.round(
    (startOfToday - new Date(d).setHours(0, 0, 0, 0)) / DAY,
  );
  if (days <= 0) return t.today;
  if (days === 1) return t.yesterday;
  if (days < 30) return t.daysAgo(days);
  return fmtDate(iso);
}

/** 刚刚 / N 分钟前 / N 小时前, then the plain date — for "last synced". */
export function relTime(
  ms: number,
  now = Date.now(),
  locale: Locale = "zh",
): string {
  const t = MESSAGES[locale];
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutesAgo(min);
  if (min < 24 * 60) return t.hoursAgo(Math.floor(min / 60));
  return fmtDate(new Date(ms).toISOString());
}
