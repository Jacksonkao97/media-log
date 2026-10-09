/* AniList (https://docs.anilist.co): airing schedules, a season's anime and
 * trending manga, through its public GraphQL API (no key needed). Runs on the
 * server, in the /api/discover route: every request goes through Next's fetch
 * cache, so AniList sees a handful of requests an hour however many people
 * open the page. Its rate limit is 90 requests a minute, currently cut to 30
 * while the API is degraded. */

import type { MangaCountry, SeasonRef } from "./feeds";
import {
  UpstreamError,
  regionOf,
  type Airing,
  type Phase,
  type Work,
} from "./types";

const ENDPOINT = "https://graphql.anilist.co";

/* ---------------------------------------------------------- normalising */

interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

/** The Media fields the WORK fragment asks for. */
export interface RawMedia {
  id: number;
  type: "ANIME" | "MANGA";
  format: string | null;
  status: string | null;
  countryOfOrigin: string | null;
  isAdult: boolean | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  } | null;
  synonyms: string[] | null;
  siteUrl: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
  coverImage: {
    large: string | null;
    medium: string | null;
    color: string | null;
  } | null;
  startDate: FuzzyDate | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

const WORK = `
fragment work on Media {
  id type format status countryOfOrigin isAdult
  title { romaji english native }
  synonyms siteUrl episodes chapters averageScore
  coverImage { large medium color }
  startDate { year month day }
  nextAiringEpisode { episode airingAt }
}`;

const FORMAT: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "短篇",
  MOVIE: "剧场版",
  SPECIAL: "特别篇",
  OVA: "OVA",
  ONA: "网络",
  MUSIC: "MV",
  ONE_SHOT: "短篇",
};

const PHASE: Record<string, Phase> = {
  NOT_YET_RELEASED: "upcoming",
  RELEASING: "releasing",
  HIATUS: "hiatus",
  FINISHED: "finished",
  CANCELLED: "cancelled",
};

const HAN = /\p{Script=Han}/u;
const KANA_OR_HANGUL =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** Han characters with no kana or hangul: most likely a Chinese title. */
const looksChinese = (s: string) => HAN.test(s) && !KANA_OR_HANGUL.test(s);

/** The title a Chinese reader most likely knows a work by, then a second one.
 *  AniList has no Chinese titles as such, but users often add one as a
 *  synonym; Chinese works have one as their native title. Otherwise Japanese
 *  works show their native title (kanji mostly reads fine) and others their
 *  English one, since hangul does not. */
function titlesOf(m: RawMedia): Pick<Work, "title" | "subtitle" | "titles"> {
  const { romaji, english, native } = m.title ?? {};
  const synonyms = m.synonyms ?? [];
  const chinese = synonyms.find(looksChinese);
  const country = m.countryOfOrigin?.toUpperCase();
  const title =
    (country === "CN" || country === "TW" || country === "HK"
      ? native
      : null) ||
    chinese ||
    (country === "JP" ? native : english) ||
    native ||
    romaji ||
    english ||
    `AniList #${m.id}`;
  const subtitle = [romaji, english, native].find((t) => t && t !== title);
  const titles = [title, native, romaji, english, ...synonyms];
  return {
    title,
    subtitle: subtitle ?? "",
    titles: [...new Set(titles.filter((t): t is string => Boolean(t)))],
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");
function fuzzyDate(d: FuzzyDate | null): string | null {
  if (!d?.year) return null;
  if (!d.month) return String(d.year);
  if (!d.day) return `${d.year}-${p2(d.month)}`;
  return `${d.year}-${p2(d.month)}-${p2(d.day)}`;
}

/** One AniList Media as a Work. `thumb` picks the small cover (timetable rows). */
export function normaliseMedia(m: RawMedia, thumb = false): Work {
  const type = m.type === "MANGA" ? "manga" : "anime";
  return {
    key: `anilist:${type}:${m.id}`,
    ...titlesOf(m),
    url: m.siteUrl || `https://anilist.co/${type}/${m.id}`,
    image:
      (thumb
        ? m.coverImage?.medium || m.coverImage?.large
        : m.coverImage?.large || m.coverImage?.medium) || null,
    color: m.coverImage?.color ?? null,
    // Like the migrated data, which filed every 剧场版 under 电影.
    category:
      type === "manga" ? "漫画" : m.format === "MOVIE" ? "电影" : "动画",
    region: regionOf(m.countryOfOrigin),
    phase: PHASE[m.status ?? ""] ?? "releasing",
    format: FORMAT[m.format ?? ""] ?? "",
    date: fuzzyDate(m.startDate),
    total: (type === "manga" ? m.chapters : m.episodes) ?? null,
    score: m.averageScore ? m.averageScore / 10 : null,
    next: m.nextAiringEpisode
      ? {
          episode: m.nextAiringEpisode.episode,
          airingAt: m.nextAiringEpisode.airingAt,
        }
      : null,
  };
}

/* ------------------------------------------------------------ requests */

interface PageOf<K extends string, T> {
  Page: { pageInfo: { hasNextPage: boolean | null } | null } & Record<
    K,
    (T | null)[] | null
  >;
}

async function query<T>(
  text: string,
  variables: Record<string, unknown>,
  revalidate: number,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: text + WORK, variables }),
      // Only 200 responses are stored, so a failure is retried next time.
      next: { revalidate },
    });
  } catch (err) {
    throw new UpstreamError(`连不上 AniList：${(err as Error).message}`);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T | null;
    errors?: { message?: string }[];
  } | null;
  if (res.status === 429)
    throw new UpstreamError("AniList 请求太频繁，请稍后再试");
  if (!res.ok || !json?.data) {
    const why = json?.errors?.[0]?.message;
    throw new UpstreamError(
      `AniList 出错（${res.status}${why ? `：${why}` : ""}）`,
    );
  }
  return json.data;
}

/** Fetches up to `maxPages` pages of 50, stopping at the last. */
async function pages<K extends string, T>(
  key: K,
  text: string,
  variables: Record<string, unknown>,
  revalidate: number,
  maxPages: number,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await query<PageOf<K, T>>(
      text,
      { ...variables, page },
      revalidate,
    );
    for (const x of data.Page[key] ?? []) if (x) out.push(x);
    if (!data.Page.pageInfo?.hasNextPage) break;
  }
  return out;
}

const DAY = 24 * 60 * 60;

/** Episodes airing from two days ago to a week ahead. The window moves a UTC
 *  day at a time, so the request (and its cache entry) stays the same all
 *  day; that is enough for the client to show yesterday through six days
 *  ahead in any time zone. */
export function airingWindow(now = Date.now()): { from: number; to: number } {
  const today = Math.floor(now / 1000 / DAY) * DAY;
  return { from: today - 2 * DAY, to: today + 7 * DAY };
}

export async function fetchAiring(now = Date.now()): Promise<Airing[]> {
  const list = await pages<
    "airingSchedules",
    { episode: number; airingAt: number; media: RawMedia | null }
  >(
    "airingSchedules",
    `query ($page: Int, $from: Int, $to: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
          episode airingAt media { ...work }
        }
      }
    }`,
    airingWindow(now),
    30 * 60,
    // A week is usually 150–250 episodes; this is a ceiling, not a target.
    10,
  );
  return list
    .filter((a) => a.media && !a.media.isAdult)
    .map((a) => ({
      work: normaliseMedia(a.media!, true),
      episode: a.episode,
      airingAt: a.airingAt,
    }));
}

export async function fetchSeason({
  season,
  year,
}: SeasonRef): Promise<Work[]> {
  const list = await pages<"media", RawMedia>(
    "media",
    `query ($page: Int, $season: MediaSeason, $year: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(type: ANIME, season: $season, seasonYear: $year, isAdult: false, sort: [POPULARITY_DESC]) {
          ...work
        }
      }
    }`,
    { season, year },
    60 * 60,
    2,
  );
  return list.map((m) => normaliseMedia(m));
}

export async function fetchManga(country: MangaCountry): Promise<Work[]> {
  const list = await pages<"media", RawMedia>(
    "media",
    `query ($page: Int, $country: CountryCode) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(type: MANGA, countryOfOrigin: $country, format_in: [MANGA, ONE_SHOT], isAdult: false, sort: [TRENDING_DESC]) {
          ...work
        }
      }
    }`,
    { country },
    60 * 60,
    1,
  );
  return list.map((m) => normaliseMedia(m));
}
