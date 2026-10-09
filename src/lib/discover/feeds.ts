/* The four 发现 feeds and their options. The UI builds request URLs with
 * feedUrl(); the API route reads them back with parseFeed(), which accepts
 * only the options the UI offers, so the upstream requests (and the cache
 * entries they create) stay a small, fixed set. */

export const FEED_IDS = ["airing", "season", "manga", "movies"] as const;
export type FeedId = (typeof FEED_IDS)[number];

/* ------------------------------------------------------------ seasons */

export const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
export type Season = (typeof SEASONS)[number];
export interface SeasonRef {
  season: Season;
  year: number;
}

/** The anime season a date falls in, by quarter, the way 一月 / 四月 / 七月 /
 *  十月新番 are counted. (AniList files a show by its start date, so a
 *  late-December premiere can still land in the next WINTER.) */
export const seasonOf = (d: Date): SeasonRef => ({
  season: SEASONS[Math.floor(d.getMonth() / 3)],
  year: d.getFullYear(),
});

export function shiftSeason(s: SeasonRef, by: number): SeasonRef {
  const i = s.year * 4 + SEASONS.indexOf(s.season) + by;
  return { season: SEASONS[((i % 4) + 4) % 4], year: Math.floor(i / 4) };
}

/** "2026年10月": how Chinese sites name a season. */
export const seasonLabel = (s: SeasonRef) =>
  `${s.year}年${SEASONS.indexOf(s.season) * 3 + 1}月`;

/* -------------------------------------------------------- manga, movies */

/** Manga by country of origin, labelled with the library's regions. */
export const MANGA_COUNTRIES = { JP: "日本", CN: "中国", KR: "韩国" } as const;
export type MangaCountry = keyof typeof MANGA_COUNTRIES;
const COUNTRY_CODES = Object.keys(MANGA_COUNTRIES) as MangaCountry[];

export const MOVIE_LISTS = {
  now_playing: "正在热映",
  upcoming: "即将上映",
  trending: "本周热门",
} as const;
export type MovieList = keyof typeof MOVIE_LISTS;
const MOVIE_LIST_IDS = Object.keys(MOVIE_LISTS) as MovieList[];

/* ----------------------------------------------------------- requests */

export type FeedRequest =
  | { feed: "airing" }
  | { feed: "season"; season: SeasonRef }
  | { feed: "manga"; country: MangaCountry }
  | { feed: "movies"; list: MovieList };

export function feedUrl(r: FeedRequest): string {
  switch (r.feed) {
    case "airing":
      return "/api/discover/airing";
    case "season":
      return `/api/discover/season?season=${r.season.season}&year=${r.season.year}`;
    case "manga":
      return `/api/discover/manga?country=${r.country}`;
    case "movies":
      return `/api/discover/movies?list=${r.list}`;
  }
}

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  list.includes(v as T);

/** The request a feed name and query describe, or null when the UI would
 *  never make it. A season must be within a year of `now`'s. Missing options
 *  take the UI's defaults. */
export function parseFeed(
  feed: string,
  q: URLSearchParams,
  now = new Date(),
): FeedRequest | null {
  switch (feed) {
    case "airing":
      return { feed };
    case "season": {
      const current = seasonOf(now);
      const season = q.get("season");
      const year = q.get("year");
      if (season === null && year === null) return { feed, season: current };
      const y = Number(year);
      if (
        !isOneOf(SEASONS, season) ||
        !/^\d{4}$/.test(year ?? "") ||
        Math.abs(y - current.year) > 1
      )
        return null;
      return { feed, season: { season, year: y } };
    }
    case "manga": {
      const country = q.get("country") ?? "JP";
      return isOneOf(COUNTRY_CODES, country) ? { feed, country } : null;
    }
    case "movies": {
      const list = q.get("list") ?? "now_playing";
      return isOneOf(MOVIE_LIST_IDS, list) ? { feed, list } : null;
    }
    default:
      return null;
  }
}
