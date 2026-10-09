/* The timetable's days, in the viewer's own time zone: yesterday through six
 * days ahead, so every weekly show appears exactly once and last night's
 * episodes are still a tap away in the morning. */

import type { Airing } from "./types";

export interface Day {
  /** 昨天 / 今天 / 明天, then 周X. */
  label: string;
  /** "10/9" */
  date: string;
  /** Local midnight to midnight, in unix seconds. */
  start: number;
  end: number;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const NAMED: Record<number, string> = { [-1]: "昨天", 0: "今天", 1: "明天" };

export function timetableDays(now = new Date()): Day[] {
  // new Date(y, m, d + i) rolls over months and keeps local midnight across DST.
  const midnight = (i: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
  return [-1, 0, 1, 2, 3, 4, 5].map((i) => {
    const start = midnight(i);
    return {
      label: NAMED[i] ?? WEEKDAYS[start.getDay()],
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
export function airingNote(unix: number, now = Date.now()): string {
  const min = Math.round((unix * 1000 - now) / 60_000);
  if (min <= 0) return "已更新";
  if (min < 60) return `${min} 分钟后`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} 小时后`;
  return "";
}
