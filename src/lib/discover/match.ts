/* Which discovered works are already in the library. Items added from 发现
 * keep the AniList / TMDB link, so they match exactly however their name is
 * edited later. Older items only have a (usually Chinese) name, which matches
 * when it equals one of the work's titles in the same category. That is rare
 * with AniList, which has few Chinese titles, but costs nothing to try. */

import { REGIONS, type Item, type Library, type Region } from "../schema";
import { workKey, type Work } from "./types";

export interface Owned {
  region: Region;
  item: Item;
}

/** Case, width, spaces and punctuation don't count: 「Re：从零开始」 = "re 从零开始". */
export const normTitle = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");

/** Builds the lookup once per library; calling it is two map reads per title. */
export function libraryLookup(lib: Library): (w: Work) => Owned | null {
  const byKey = new Map<string, Owned>();
  const byName = new Map<string, Owned>();
  for (const region of REGIONS) {
    for (const item of lib[region].items) {
      const hit = { region, item };
      const key = workKey(item.url);
      if (key && !byKey.has(key)) byKey.set(key, hit);
      const name = normTitle(item.name);
      const nameKey = `${item.category}:${name}`;
      if (name && !byName.has(nameKey)) byName.set(nameKey, hit);
    }
  }
  return (w) => {
    const exact = byKey.get(w.key);
    if (exact) return exact;
    for (const t of w.titles) {
      const n = normTitle(t);
      const hit = n && byName.get(`${w.category}:${n}`);
      if (hit) return hit;
    }
    return null;
  };
}
