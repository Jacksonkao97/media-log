/* TMDB (https://developer.themoviedb.org): movies now in cinemas, coming soon
 * and trending this week, with Chinese titles where TMDB has them. Needs a key
 * (TMDB_API_KEY), so it only ever runs on the server, behind Next's fetch
 * cache like AniList. TMDB's terms ask for attribution, which the movie view
 * shows. */

import type { MovieList } from "./feeds";
import { UpstreamError, type Work } from "./types";
import type { Region } from "../schema";

const API = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";

const PATHS: Record<MovieList, string> = {
  now_playing: "/movie/now_playing",
  upcoming: "/movie/upcoming",
  trending: "/trending/movie/week",
};

/** TMDB_API_KEY, or null when movies are not set up. */
export const tmdbKey = () => process.env.TMDB_API_KEY?.trim() || null;

/** TMDB_REGION: ISO 3166-1 code (CN, TW, US…) whose cinema dates 正在热映 and
 *  即将上映 follow; without it they mix every country's. */
export const tmdbRegion = () =>
  process.env.TMDB_REGION?.trim().toUpperCase() || null;

/** Settings → API offers two credentials; either works. The read access token
 *  (a JWT, three dot-separated parts) goes in a header, the older 32-character
 *  API key in the query. */
export function tmdbAuth(key: string): {
  headers: Record<string, string>;
  params: Record<string, string>;
} {
  return key.includes(".")
    ? { headers: { Authorization: `Bearer ${key}` }, params: {} }
    : { headers: {}, params: { api_key: key } };
}

export interface RawMovie {
  id: number;
  title?: string | null;
  original_title?: string | null;
  original_language?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  adult?: boolean | null;
}

/** The original language (ISO 639-1) as one of the library's regions. */
function regionOfLanguage(lang: string | null | undefined): Region {
  switch (lang) {
    case "ja":
      return "日本";
    case "zh":
    case "cn": // TMDB's code for Cantonese
      return "中国";
    case "ko":
      return "韩国";
    default:
      return "欧美";
  }
}

/** One TMDB movie as a Work. `today` (YYYY-MM-DD) tells released from upcoming. */
export function normaliseMovie(m: RawMovie, today: string): Work {
  const original = m.original_title?.trim() || "";
  const title = m.title?.trim() || original || `TMDB #${m.id}`;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(m.release_date ?? "")
    ? m.release_date!
    : null;
  return {
    key: `tmdb:movie:${m.id}`,
    title,
    subtitle: original !== title ? original : "",
    titles: [...new Set([title, original].filter(Boolean))],
    url: `https://www.themoviedb.org/movie/${m.id}`,
    image: m.poster_path ? POSTER + m.poster_path : null,
    color: null,
    category: "电影",
    region: regionOfLanguage(m.original_language),
    phase: date && date > today ? "upcoming" : "finished",
    format: "",
    date,
    total: null,
    // A handful of votes says little.
    score:
      m.vote_average && (m.vote_count ?? 0) >= 10
        ? Math.round(m.vote_average * 10) / 10
        : null,
    next: null,
  };
}

/** Two pages (40 movies) of a list, Chinese titles first. */
export async function fetchMovies(
  list: MovieList,
  key: string,
  region: string | null,
  now = new Date(),
): Promise<Work[]> {
  const auth = tmdbAuth(key);
  const today = now.toISOString().slice(0, 10);
  const seen = new Set<number>();
  const out: Work[] = [];
  for (let page = 1; page <= 2; page++) {
    const params = new URLSearchParams({
      ...auth.params,
      language: "zh-CN",
      page: String(page),
      ...(region && list !== "trending" ? { region } : {}),
    });
    let res: Response;
    try {
      res = await fetch(`${API}${PATHS[list]}?${params}`, {
        headers: { Accept: "application/json", ...auth.headers },
        next: { revalidate: 6 * 60 * 60 },
      });
    } catch (err) {
      throw new UpstreamError(`连不上 TMDB：${(err as Error).message}`);
    }
    if (res.status === 401)
      throw new UpstreamError("TMDB 拒绝了 TMDB_API_KEY，检查一下是否填对");
    if (res.status === 429)
      throw new UpstreamError("TMDB 请求太频繁，请稍后再试");
    if (!res.ok) throw new UpstreamError(`TMDB 出错（${res.status}）`);
    const json = (await res.json().catch(() => ({}))) as {
      results?: RawMovie[];
      total_pages?: number;
    };
    // Pages can overlap when the list shifts between requests.
    for (const m of json.results ?? []) {
      if (m.adult || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(normaliseMovie(m, today));
    }
    if (page >= (json.total_pages ?? 1)) break;
  }
  return out;
}
