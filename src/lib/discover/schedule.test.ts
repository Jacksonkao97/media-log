import { describe, expect, it } from "vitest";
import { airingNote, airingOn, clock, timetableDays } from "./schedule";
import type { Airing, Work } from "./types";

/* Local-time helpers, so these pass in any time zone. */
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime() / 1000;

const airing = (airingAt: number, episode = 1): Airing => ({
  work: { key: `k${airingAt}` } as Work,
  episode,
  airingAt,
});

describe("timetableDays", () => {
  it("runs from yesterday to six days ahead", () => {
    const days = timetableDays(new Date(2026, 9, 9, 15, 0)); // a Friday
    expect(days.map((d) => d.label)).toEqual([
      "昨天",
      "今天",
      "明天",
      "周日",
      "周一",
      "周二",
      "周三",
    ]);
    expect(days.map((d) => d.date)).toEqual([
      "10/8",
      "10/9",
      "10/10",
      "10/11",
      "10/12",
      "10/13",
      "10/14",
    ]);
    expect(days[1].start).toBe(at(2026, 10, 9));
    expect(days[1].end).toBe(at(2026, 10, 10));
    // Each day ends where the next starts.
    for (let i = 1; i < days.length; i++)
      expect(days[i].start).toBe(days[i - 1].end);
  });

  it("rolls over month ends", () => {
    const days = timetableDays(new Date(2026, 9, 31, 23, 59));
    expect(days.map((d) => d.date).slice(0, 4)).toEqual([
      "10/30",
      "10/31",
      "11/1",
      "11/2",
    ]);
  });
});

describe("airingOn", () => {
  it("keeps one day's episodes, earliest first", () => {
    const [, today] = timetableDays(new Date(2026, 9, 9, 12));
    const list = [
      airing(at(2026, 10, 9, 23, 30)),
      airing(at(2026, 10, 10, 0, 0)), // tomorrow
      airing(at(2026, 10, 9, 0, 0)),
      airing(at(2026, 10, 8, 23, 59)), // yesterday
    ];
    expect(airingOn(list, today).map((a) => clock(a.airingAt))).toEqual([
      "00:00",
      "23:30",
    ]);
  });
});

describe("airingNote", () => {
  const now = at(2026, 10, 9, 12) * 1000;
  it("says aired, or counts down within a day", () => {
    expect(airingNote(at(2026, 10, 9, 11), now)).toBe("已更新");
    expect(airingNote(at(2026, 10, 9, 12), now)).toBe("已更新");
    expect(airingNote(at(2026, 10, 9, 12, 25), now)).toBe("25 分钟后");
    expect(airingNote(at(2026, 10, 9, 13, 59), now)).toBe("1 小时后");
    expect(airingNote(at(2026, 10, 10, 11), now)).toBe("23 小时后");
    expect(airingNote(at(2026, 10, 10, 13), now)).toBe("");
  });
});
