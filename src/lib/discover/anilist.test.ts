import { afterEach, describe, expect, it, vi } from "vitest";
import {
  airingWindow,
  fetchAiring,
  fetchSeason,
  normaliseMedia,
  type RawMedia,
} from "./anilist";
import { UpstreamError } from "./types";

const media = (over: Partial<RawMedia> = {}): RawMedia => ({
  id: 1,
  type: "ANIME",
  format: "TV",
  status: "RELEASING",
  countryOfOrigin: "JP",
  isAdult: false,
  title: {
    romaji: "Sousou no Frieren",
    english: "Frieren",
    native: "葬送のフリーレン",
  },
  synonyms: [],
  siteUrl: "https://anilist.co/anime/1",
  episodes: 28,
  chapters: null,
  averageScore: 91,
  coverImage: { large: "L.jpg", medium: "M.jpg", color: "#e4a15d" },
  startDate: { year: 2023, month: 9, day: 29 },
  nextAiringEpisode: { episode: 5, airingAt: 1_790_000_000 },
  ...over,
});

describe("normaliseMedia", () => {
  it("maps an anime", () => {
    expect(normaliseMedia(media())).toEqual({
      key: "anilist:anime:1",
      title: "葬送のフリーレン",
      subtitle: "Sousou no Frieren",
      titles: ["葬送のフリーレン", "Sousou no Frieren", "Frieren"],
      url: "https://anilist.co/anime/1",
      image: "L.jpg",
      color: "#e4a15d",
      category: "动画",
      region: "日本",
      phase: "releasing",
      format: "TV",
      date: "2023-09-29",
      total: 28,
      score: 9.1,
      next: { episode: 5, airingAt: 1_790_000_000 },
    });
  });

  it("prefers a Chinese synonym, but not a Japanese one", () => {
    const w = normaliseMedia(
      media({ synonyms: ["フリーレン", "葬送的芙莉莲", "Frieren: Beyond"] }),
    );
    expect(w.title).toBe("葬送的芙莉莲");
    expect(w.subtitle).toBe("Sousou no Frieren");
    expect(w.titles).toContain("フリーレン");
  });

  it("titles Chinese works by their native title", () => {
    const w = normaliseMedia(
      media({
        countryOfOrigin: "CN",
        title: {
          romaji: "Doupo Cangqiong",
          english: "Battle Through the Heavens",
          native: "斗破苍穹",
        },
      }),
    );
    expect(w).toMatchObject({ title: "斗破苍穹", region: "中国" });
  });

  it("titles Korean works in English rather than hangul", () => {
    const w = normaliseMedia(
      media({
        type: "MANGA",
        format: "MANGA",
        countryOfOrigin: "KR",
        title: {
          romaji: "Jeonjijeok Dokja Sijeom",
          english: "Omniscient Reader",
          native: "전지적 독자 시점",
        },
        chapters: 250,
        episodes: null,
        siteUrl: null,
      }),
    );
    expect(w).toMatchObject({
      key: "anilist:manga:1",
      title: "Omniscient Reader",
      subtitle: "Jeonjijeok Dokja Sijeom",
      category: "漫画",
      region: "韩国",
      format: "",
      total: 250,
      url: "https://anilist.co/manga/1",
    });
  });

  it("files movies under 电影, like the migrated 剧场版", () => {
    expect(normaliseMedia(media({ format: "MOVIE" }))).toMatchObject({
      category: "电影",
      format: "剧场版",
    });
  });

  it("maps every release status", () => {
    const phase = (status: string | null) =>
      normaliseMedia(media({ status })).phase;
    expect(phase("NOT_YET_RELEASED")).toBe("upcoming");
    expect(phase("HIATUS")).toBe("hiatus");
    expect(phase("FINISHED")).toBe("finished");
    expect(phase("CANCELLED")).toBe("cancelled");
    expect(phase(null)).toBe("releasing");
  });

  it("copes with missing fields", () => {
    const w = normaliseMedia(
      media({
        title: null,
        synonyms: null,
        coverImage: null,
        startDate: { year: 2026, month: 10, day: null },
        averageScore: null,
        nextAiringEpisode: null,
        countryOfOrigin: null,
      }),
    );
    expect(w).toMatchObject({
      title: "AniList #1",
      subtitle: "",
      titles: ["AniList #1"],
      image: null,
      color: null,
      date: "2026-10",
      score: null,
      next: null,
      region: "欧美",
    });
    expect(
      normaliseMedia(
        media({ startDate: { year: null, month: null, day: null } }),
      ).date,
    ).toBeNull();
  });

  it("uses the small cover for timetable rows", () => {
    expect(normaliseMedia(media(), true).image).toBe("M.jpg");
  });
});

describe("airingWindow", () => {
  it("runs from two days back to a week ahead, whole UTC days", () => {
    const now = Date.UTC(2026, 9, 9, 15, 42);
    const { from, to } = airingWindow(now);
    expect(new Date(from * 1000).toISOString()).toBe(
      "2026-10-07T00:00:00.000Z",
    );
    expect(new Date(to * 1000).toISOString()).toBe("2026-10-16T00:00:00.000Z");
    // The same all day, so the cached request is reused.
    expect(airingWindow(Date.UTC(2026, 9, 9, 0, 1))).toEqual({ from, to });
  });
});

/* The requests themselves, against a stubbed fetch: paging, adult filtering,
 * and errors. */
describe("AniList requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it("pages through the airing schedule and drops adult titles", async () => {
    const page = (n: number, hasNextPage: boolean) => ({
      data: {
        Page: {
          pageInfo: { hasNextPage },
          airingSchedules: [
            { episode: n, airingAt: 100 + n, media: media({ id: n }) },
            {
              episode: 1,
              airingAt: 200,
              media: media({ id: 99, isAdult: true }),
            },
            null,
          ],
        },
      },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(page(1, true)))
      .mockResolvedValueOnce(reply(page(2, false)));
    vi.stubGlobal("fetch", fetch);

    const airing = await fetchAiring(Date.UTC(2026, 9, 9));
    expect(airing.map((a) => [a.work.key, a.episode])).toEqual([
      ["anilist:anime:1", 1],
      ["anilist:anime:2", 2],
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe("https://graphql.anilist.co");
    const body = JSON.parse(init.body);
    expect(body.variables).toMatchObject({
      page: 2,
      ...airingWindow(Date.UTC(2026, 9, 9)),
    });
    expect(body.query).toContain("fragment work on Media");
    expect(init.next).toEqual({ revalidate: 1800 });
  });

  it("stops after two pages of a season", async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      reply({
        data: { Page: { pageInfo: { hasNextPage: true }, media: [media()] } },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const works = await fetchSeason({ season: "FALL", year: 2026 });
    expect(works).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[0][1].body).variables).toEqual({
      season: "FALL",
      year: 2026,
      page: 1,
    });
  });

  it("turns failures into UpstreamError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ data: null }, 429)),
    );
    await expect(fetchSeason({ season: "FALL", year: 2026 })).rejects.toThrow(
      new UpstreamError("AniList 请求太频繁，请稍后再试"),
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          reply({ data: null, errors: [{ message: "Validation error" }] }, 400),
        ),
    );
    await expect(fetchSeason({ season: "FALL", year: 2026 })).rejects.toThrow(
      "AniList 出错（400：Validation error）",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(
      fetchSeason({ season: "FALL", year: 2026 }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
