import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMovies, normaliseMovie, tmdbAuth, type RawMovie } from "./tmdb";

const movie = (over: Partial<RawMovie> = {}): RawMovie => ({
  id: 129,
  title: "千与千寻",
  original_title: "千と千尋の神隠し",
  original_language: "ja",
  poster_path: "/p.jpg",
  release_date: "2001-07-20",
  vote_average: 8.537,
  vote_count: 17000,
  adult: false,
  ...over,
});

describe("normaliseMovie", () => {
  it("maps a movie", () => {
    expect(normaliseMovie(movie(), "2026-10-09")).toEqual({
      key: "tmdb:movie:129",
      title: "千与千寻",
      subtitle: "千と千尋の神隠し",
      titles: ["千与千寻", "千と千尋の神隠し"],
      url: "https://www.themoviedb.org/movie/129",
      image: "https://image.tmdb.org/t/p/w342/p.jpg",
      color: null,
      category: "电影",
      region: "日本",
      phase: "finished",
      format: "",
      date: "2001-07-20",
      total: null,
      score: 8.5,
      next: null,
    });
  });

  it("tells upcoming from released", () => {
    expect(
      normaliseMovie(movie({ release_date: "2026-10-10" }), "2026-10-09").phase,
    ).toBe("upcoming");
    expect(
      normaliseMovie(movie({ release_date: "2026-10-09" }), "2026-10-09").phase,
    ).toBe("finished");
    expect(
      normaliseMovie(movie({ release_date: "" }), "2026-10-09"),
    ).toMatchObject({
      date: null,
      phase: "finished",
    });
  });

  it("files movies by original language", () => {
    const region = (original_language: string) =>
      normaliseMovie(movie({ original_language }), "2026-10-09").region;
    expect(region("zh")).toBe("中国");
    expect(region("cn")).toBe("中国");
    expect(region("ko")).toBe("韩国");
    expect(region("en")).toBe("欧美");
    expect(region("fr")).toBe("欧美");
  });

  it("falls back to the original title and hides thin scores", () => {
    const w = normaliseMovie(
      movie({
        title: "",
        original_title: "Sisu",
        poster_path: null,
        vote_count: 3,
      }),
      "2026-10-09",
    );
    expect(w).toMatchObject({
      title: "Sisu",
      subtitle: "",
      titles: ["Sisu"],
      image: null,
      score: null,
    });
  });
});

describe("tmdbAuth", () => {
  it("sends a read access token as a bearer header", () => {
    expect(tmdbAuth("eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.sig")).toEqual({
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.sig",
      },
      params: {},
    });
  });

  it("sends a v3 API key as a query parameter", () => {
    expect(tmdbAuth("0123456789abcdef0123456789abcdef")).toEqual({
      headers: {},
      params: { api_key: "0123456789abcdef0123456789abcdef" },
    });
  });
});

describe("fetchMovies", () => {
  afterEach(() => vi.unstubAllGlobals());

  const reply = (results: RawMovie[], total_pages = 2, status = 200) =>
    new Response(JSON.stringify({ page: 1, results, total_pages }), { status });

  it("reads two pages in Chinese, skipping repeats and adult titles", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        reply([movie({ id: 1 }), movie({ id: 2, adult: true })]),
      )
      .mockResolvedValueOnce(reply([movie({ id: 1 }), movie({ id: 3 })]));
    vi.stubGlobal("fetch", fetch);

    const works = await fetchMovies(
      "now_playing",
      "k".repeat(32),
      "TW",
      new Date("2026-10-09T12:00:00Z"),
    );
    expect(works.map((w) => w.key)).toEqual(["tmdb:movie:1", "tmdb:movie:3"]);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/3/movie/now_playing");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api_key: "k".repeat(32),
      language: "zh-CN",
      page: "1",
      region: "TW",
    });
  });

  it("leaves the region off the trending list and stops at the last page", async () => {
    const fetch = vi.fn().mockResolvedValue(reply([movie()], 1));
    vi.stubGlobal("fetch", fetch);
    await fetchMovies("trending", "a.b.c", "TW");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [u, init] = fetch.mock.calls[0];
    const url = new URL(u);
    expect(url.pathname).toBe("/3/trending/movie/week");
    expect(url.searchParams.has("region")).toBe(false);
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(init.headers.Authorization).toBe("Bearer a.b.c");
  });

  it("explains a rejected key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply([], 1, 401)));
    await expect(fetchMovies("upcoming", "bad", null)).rejects.toThrow(
      "TMDB 拒绝了 TMDB_API_KEY",
    );
  });
});
