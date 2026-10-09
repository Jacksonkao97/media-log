import { describe, expect, it } from "vitest";
import {
  feedUrl,
  parseFeed,
  seasonLabel,
  seasonOf,
  shiftSeason,
  type FeedRequest,
} from "./feeds";

const q = (s = "") => new URLSearchParams(s);
const NOW = new Date(2026, 9, 9);

describe("seasons", () => {
  it("counts seasons by quarter", () => {
    expect(seasonOf(new Date(2026, 0, 1))).toEqual({
      season: "WINTER",
      year: 2026,
    });
    expect(seasonOf(new Date(2026, 3, 1))).toEqual({
      season: "SPRING",
      year: 2026,
    });
    expect(seasonOf(new Date(2026, 8, 30))).toEqual({
      season: "SUMMER",
      year: 2026,
    });
    expect(seasonOf(new Date(2026, 11, 31))).toEqual({
      season: "FALL",
      year: 2026,
    });
  });

  it("steps across years", () => {
    const fall = { season: "FALL", year: 2026 } as const;
    expect(shiftSeason(fall, 1)).toEqual({ season: "WINTER", year: 2027 });
    expect(shiftSeason(fall, -1)).toEqual({ season: "SUMMER", year: 2026 });
    expect(shiftSeason({ season: "WINTER", year: 2026 }, -1)).toEqual({
      season: "FALL",
      year: 2025,
    });
  });

  it("names seasons by their first month", () => {
    expect(seasonLabel({ season: "WINTER", year: 2027 })).toBe("2027年1月");
    expect(seasonLabel({ season: "FALL", year: 2026 })).toBe("2026年10月");
  });
});

describe("parseFeed", () => {
  it("reads back every URL the UI builds", () => {
    const requests: FeedRequest[] = [
      { feed: "airing" },
      { feed: "season", season: { season: "SUMMER", year: 2026 } },
      { feed: "season", season: { season: "WINTER", year: 2027 } },
      { feed: "manga", country: "KR" },
      { feed: "movies", list: "upcoming" },
    ];
    for (const r of requests) {
      const url = new URL(feedUrl(r), "http://x");
      const feed = url.pathname.split("/").pop()!;
      expect(parseFeed(feed, url.searchParams, NOW)).toEqual(r);
    }
  });

  it("fills in defaults", () => {
    expect(parseFeed("season", q(), NOW)).toEqual({
      feed: "season",
      season: { season: "FALL", year: 2026 },
    });
    expect(parseFeed("manga", q(), NOW)).toEqual({
      feed: "manga",
      country: "JP",
    });
    expect(parseFeed("movies", q(), NOW)).toEqual({
      feed: "movies",
      list: "now_playing",
    });
  });

  it("refuses anything the UI would not ask for", () => {
    expect(parseFeed("anime", q(), NOW)).toBeNull();
    expect(parseFeed("season", q("season=FALL&year=1999"), NOW)).toBeNull();
    expect(parseFeed("season", q("season=fall&year=2026"), NOW)).toBeNull();
    expect(parseFeed("season", q("season=FALL"), NOW)).toBeNull();
    expect(parseFeed("season", q("season=FALL&year=2026.5"), NOW)).toBeNull();
    expect(parseFeed("manga", q("country=US"), NOW)).toBeNull();
    expect(parseFeed("movies", q("list=popular"), NOW)).toBeNull();
    expect(parseFeed("toString", q(), NOW)).toBeNull();
  });
});
