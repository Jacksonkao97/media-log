/* The timetable's days, in the viewer's own time zone: yesterday through six
 * days ahead, so every weekly show appears exactly once and last night's
 * episodes are still a tap away in the morning. */

import { MESSAGES, type Locale } from "../messages";
import type { Airing } from "./types";

export interface Day {
  /** 昨天 / 今天 / 明天, then 周X (or English). */
  label: string;
  /** "10/9" */
  date: string;
  /** Local midnight to midnight, in unix seconds. */
  start: number;
  end: number;
}

export function timetableDays(now = new Date(), locale: Locale = "zh"): Day[] {
  const t = MESSAGES[locale];
  const named: Record<number, string> = {
    [-1]: t.yesterday,
    0: t.today,
    1: t.tomorrow,
  };
  // new Date(y, m, d + i) rolls over months and keeps local midnight across DST.
  const midnight = (i: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
  return [-1, 0, 1, 2, 3, 4, 5].map((i) => {
    const start = midnight(i);
    return {
      label: named[i] ?? t.weekdays[start.getDay()],
      date: `${start.getMonth() + 1}/${start.getDate()}`,
      start: start.getTime() / 1000,
      end: midnight(i + 1).getTime() / 1000,
    };
  });
}

/** The episodes airing on `day`, earliest first. */
export const airingOn = (airing: Airing[], day: Day) =>
  airing
    .filter((a) => a.airingAt >= day.start && a.airingAt < day.end)
    .sort((a, b) => a.airingAt - b.airingAt);

/** Local 24-hour clock time: "23:30". */
export function clock(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 已更新 once aired; a countdown within the next day; otherwise nothing. */
export function airingNote(
  unix: number,
  now = Date.now(),
  locale: Locale = "zh",
): string {
  const t = MESSAGES[locale];
  const min = Math.round((unix * 1000 - now) / 60_000);
  if (min <= 0) return t.aired;
  if (min < 60) return t.inMinutes(min);
  if (min < 24 * 60) return t.inHours(Math.floor(min / 60));
  return "";
}
