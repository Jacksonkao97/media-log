import { describe, expect, it } from "vitest";
import { seasonLabel } from "./discover/feeds";
import { airingNote, timetableDays } from "./discover/schedule";
import { relDate, relTime } from "./format";
import { MESSAGES, getLocale, t, zhName } from "./i18n";
import { CATEGORIES, REGIONS, STATUSES, WATCHES } from "./schema";
import { DEFAULT_VIEW, viewTitle } from "./view";

describe("locale", () => {
  it("is Chinese outside the browser", () => {
    expect(getLocale()).toBe("zh");
    expect(t()).toBe(MESSAGES.zh);
  });
});

describe("messages", () => {
  it("label every value the data model allows, in both languages", () => {
    for (const m of Object.values(MESSAGES)) {
      for (const r of REGIONS) expect(m.region[r]).toBeTruthy();
      for (const c of CATEGORIES) expect(m.category[c]).toBeTruthy();
      for (const w of WATCHES) expect(m.watch[w]).toBeTruthy();
      for (const s of STATUSES) expect(m.status[s]).toBeTruthy();
    }
  });

  it("show the data's own values in Chinese", () => {
    for (const c of CATEGORIES) expect(MESSAGES.zh.category[c]).toBe(c);
    for (const r of REGIONS) expect(MESSAGES.zh.region[r]).toBe(r);
  });
});

describe("zhName", () => {
  it("reports English labels under their Chinese names", () => {
    expect(zhName("Japan")).toBe("日本");
    expect(zhName("TV series")).toBe("电视剧");
    expect(zhName("Watching")).toBe("看着");
    expect(zhName("Clear filters")).toBe("清除筛选");
    expect(zhName("Sign in to sync with Google")).toBe("登录 Google 同步");
    expect(zhName("Undo")).toBe("撤销");
  });

  it("keeps the first meaning when one English word has two", () => {
    // The clickable ones: the 新增 button, the phone menu's install entry,
    // the phone tab for 季度新番.
    expect(zhName("Add")).toBe("新增");
    expect(zhName("Add to Home Screen")).toBe("安装到主屏幕");
    expect(zhName("Season")).toBe("新番");
  });

  it("leaves Chinese and unknown names alone", () => {
    expect(zhName("日本")).toBe("日本");
    expect(zhName("编辑作品")).toBe("编辑作品");
    expect(zhName("something else")).toBe("something else");
  });
});

describe("English formatting", () => {
  it("names views", () => {
    expect(viewTitle(DEFAULT_VIEW, "en")).toBe("Japan · MediaLog");
    expect(viewTitle({ ...DEFAULT_VIEW, section: "discover" }, "en")).toBe(
      "Airing schedule · MediaLog",
    );
  });

  it("says how long ago", () => {
    const now = Date.now();
    expect(relTime(now - 5 * 60_000, now, "en")).toBe("5 min ago");
    expect(relTime(now - 3 * 3600_000, now, "en")).toBe("3 hours ago");
    expect(relDate(new Date().toISOString(), "en")).toBe("Today");
  });

  it("names seasons and timetable days", () => {
    expect(seasonLabel({ season: "FALL", year: 2026 }, "en")).toBe("Fall 2026");
    const days = timetableDays(new Date(2026, 9, 9, 15, 0), "en"); // a Friday
    expect(days.map((d) => d.label)).toEqual([
      "Yesterday",
      "Today",
      "Tomorrow",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
    ]);
    const now = new Date(2026, 9, 9, 12).getTime();
    expect(airingNote(now / 1000 + 25 * 60, now, "en")).toBe("in 25 min");
    expect(airingNote(now / 1000 - 60, now, "en")).toBe("Aired");
  });

  it("writes release dates", () => {
    const { date } = MESSAGES.en;
    expect(date(2026, 10, 4, true)).toBe("Oct 4");
    expect(date(2027, 1, 15, false)).toBe("Jan 15, 2027");
    expect(date(2027, 3)).toBe("Mar 2027");
    expect(date(2027)).toBe("2027");
    expect(MESSAGES.zh.date(2026, 10, 4, true)).toBe("10月4日");
    expect(MESSAGES.zh.date(2027, 1, 15, false)).toBe("2027年1月15日");
  });
});
