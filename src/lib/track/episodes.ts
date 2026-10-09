/* AniList: which followed anime aired an episode in a time window. One
 * request per 50 episodes, never cached (the tracker needs fresh answers). */

import { query } from "../discover/anilist";

export interface Aired {
  mediaId: number;
  episode: number;
  /** Unix seconds. */
  airingAt: number;
}

export async function fetchAired(
  ids: number[],
  from: number,
  to: number,
): Promise<Aired[]> {
  if (!ids.length) return [];
  const out: Aired[] = [];
  // Even a long window rarely holds more than a page or two.
  for (let page = 1; page <= 5; page++) {
    const data = await query<{
      Page: {
        pageInfo: { hasNextPage: boolean | null } | null;
        airingSchedules: (Aired | null)[] | null;
      };
    }>(
      `query ($page: Int, $ids: [Int], $from: Int, $to: Int) {
        Page(page: $page, perPage: 50) {
          pageInfo { hasNextPage }
          airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
            mediaId episode airingAt
          }
        }
      }`,
      { page, ids, from, to },
      0,
    );
    for (const a of data.Page.airingSchedules ?? []) if (a) out.push(a);
    if (!data.Page.pageInfo?.hasNextPage) break;
  }
  return out;
}
