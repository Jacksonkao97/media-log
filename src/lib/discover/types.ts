/* The 发现 feeds: what is airing this week, a season's anime, trending manga
 * and movies. AniList and TMDB results are both normalised into `Work`: what
 * the cards show, plus what the editor needs to add one to the library.
 * Shared by the API route (server) and the UI (client), so no Node or browser
 * APIs here. */

import type { Category, Region, Status } from "../schema";

/** Where a work is in its run. */
export type Phase =
  "upcoming" | "releasing" | "hiatus" | "finished" | "cancelled";

export interface Work {
  /** "anilist:anime:21", "anilist:manga:30013", "tmdb:movie:550" (see workKey). */
  key: string;
  title: string;
  /** A second title worth showing under the first (romaji, original), or "". */
  subtitle: string;
  /** Every known title, to recognise works already in the library. */
  titles: string[];
  url: string;
  image: string | null;
  /** The cover's average colour (AniList), shown while it loads. */
  color: string | null;
  category: Category;
  region: Region;
  phase: Phase;
  /** "TV", "剧场版", "网络"…; "" when unknown or not worth showing. */
  format: string;
  /** Start or release date: "2026-10-04", or "2026-10" / "2026" when only partly known. */
  date: string | null;
  /** Episodes (anime) or chapters (manga), when known. */
  total: number | null;
  /** Out of 10. */
  score: number | null;
  /** Anime still airing: the next episode. */
  next: { episode: number; airingAt: number } | null;
}

export interface Airing {
  work: Work;
  episode: number;
  /** Unix seconds. */
  airingAt: number;
}

/** What /api/discover/[feed] returns. */
export type FeedData =
  { kind: "works"; works: Work[] } | { kind: "airing"; airing: Airing[] };

/** AniList or TMDB failed to answer; the API route replies 502 with the message. */
export class UpstreamError extends Error {}

/** The library's 完结 / 未完结 for a work in this phase. */
export const toStatus = (phase: Phase): Status =>
  phase === "finished" || phase === "cancelled" ? "完结" : "未完结";

/** AniList's countryOfOrigin (ISO 3166-1) as one of the library's regions. */
export function regionOf(country: string | null | undefined): Region {
  switch (country?.toUpperCase()) {
    case "JP":
      return "日本";
    case "CN":
    case "TW":
    case "HK":
      return "中国";
    case "KR":
      return "韩国";
    default:
      return "欧美";
  }
}

/** The work an AniList or TMDB link points at, as a Work key; null for any
 *  other link. Library items added from 发现 keep that link, which is how
 *  they are recognised later (their names are usually edited). */
export function workKey(url: string): string | null {
  const a = url.match(
    /^https?:\/\/(?:www\.)?anilist\.co\/(anime|manga)\/(\d+)(?:[/?#]|$)/i,
  );
  if (a) return `anilist:${a[1].toLowerCase()}:${a[2]}`;
  const t = url.match(
    /^https?:\/\/(?:www\.)?themoviedb\.org\/movie\/(\d+)(?:[-/?#]|$)/i,
  );
  if (t) return `tmdb:movie:${t[1]}`;
  return null;
}
