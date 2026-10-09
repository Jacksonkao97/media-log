/* The 发现 feeds as JSON: GET /api/discover/{airing,season,manga,movies}
 * (options in lib/discover/feeds.ts).
 *
 * Two caches keep AniList and TMDB from seeing more than a handful of
 * requests an hour: Next's fetch cache under each upstream call, and
 * s-maxage on the response for a CDN in front (Vercel's), which then answers
 * repeats without running this at all. parseFeed() only accepts the options
 * the UI offers, so neither cache can be filled with arbitrary requests. */

import type { NextRequest } from "next/server";
import { fetchAiring, fetchManga, fetchSeason } from "@/lib/discover/anilist";
import { parseFeed, type FeedRequest } from "@/lib/discover/feeds";
import { fetchMovies, tmdbKey, tmdbRegion } from "@/lib/discover/tmdb";
import { UpstreamError, type FeedData } from "@/lib/discover/types";

async function load(r: FeedRequest, key: string | null): Promise<FeedData> {
  switch (r.feed) {
    case "airing":
      return { kind: "airing", airing: await fetchAiring() };
    case "season":
      return { kind: "works", works: await fetchSeason(r.season) };
    case "manga":
      return { kind: "works", works: await fetchManga(r.country) };
    case "movies":
      return {
        kind: "works",
        works: await fetchMovies(r.list, key!, tmdbRegion()),
      };
  }
}

const fail = (status: number, error: string) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/discover/[feed]">,
) {
  const { feed } = await ctx.params;
  const request = parseFeed(feed, req.nextUrl.searchParams);
  if (!request) return fail(404, "没有这个资讯");
  const key = tmdbKey();
  if (request.feed === "movies" && !key)
    return fail(503, "电影资讯还没有配置：服务器需要设置 TMDB_API_KEY");

  try {
    return Response.json(await load(request, key), {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) return fail(502, err.message);
    console.error(err);
    return fail(500, "服务器出错了");
  }
}
