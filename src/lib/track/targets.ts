/* What 更新提醒 follows. An item is followed while its watch state is 看着
 * and its link says where to look:
 *   - 动画 linked to AniList        → target "anilist:<media id>"  (new episodes)
 *   - 漫画 linked to manhuagui      → target "manhuagui:<comic id>" (new chapters)
 * The browser derives the list from the library and sends it to the server,
 * which only ever sees these targets plus the names to put in notifications.
 * Shared by client and server: no Node or browser APIs here. */

import { REGIONS, type Item, type Library } from "../schema";
import { workKey } from "../discover/types";

export interface Follow {
  /** The library item's id. */
  id: string;
  /** Its name, for the notification title. */
  name: string;
  target: string;
  /** Its progress, so a notification can say how far behind you are. */
  progress: string;
}

const MANHUAGUI =
  /^https?:\/\/(?:(?:www|tw|m)\.)?manhuagui\.com\/comic\/(\d+)(?:[/?#]|$)/i;

/** The target an item is followed by, or null if it isn't followed. */
export function targetOf(item: Item): string | null {
  if (item.watch !== "看着") return null;
  if (item.category === "动画") {
    const key = workKey(item.url);
    return key?.startsWith("anilist:anime:")
      ? `anilist:${key.slice("anilist:anime:".length)}`
      : null;
  }
  if (item.category === "漫画") {
    const m = item.url.match(MANHUAGUI);
    return m ? `manhuagui:${m[1]}` : null;
  }
  return null;
}

/** Everything the library follows, one entry per target. */
export function followsOf(lib: Library): Follow[] {
  const seen = new Set<string>();
  const out: Follow[] = [];
  for (const region of REGIONS) {
    for (const item of lib[region].items) {
      const target = targetOf(item);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      out.push({
        id: item.id,
        name: item.name,
        target,
        progress: item.progress,
      });
    }
  }
  return out;
}

/** What /api/track/subscribe and /status say about a device. */
export interface TrackStatus {
  following: number;
  anime: number;
  manga: number;
  /** When the scheduler last ran a round (unix ms), or null if never. */
  lastRun: number | null;
  /** How often each manga is re-checked (TRACK_MANGA_HOURS). */
  mangaHours: number;
  /** Followed works whose last check failed. */
  failing: { name: string; error: string }[];
}

export const isAnime = (target: string) => target.startsWith("anilist:");

/** The numeric id in a target. */
export const targetId = (target: string) =>
  Number(target.slice(target.indexOf(":") + 1));

/** Where a notification about `target` should open: the comic's page for
 *  manga (that's where you read it), the app for anime. */
export const targetUrl = (target: string) =>
  isAnime(target)
    ? "/"
    : `https://www.manhuagui.com/comic/${targetId(target)}/`;

/* ------------------------------------------------- validating (server) */

export const MAX_FOLLOWS = 500;
const TARGET = /^(anilist|manhuagui):[1-9]\d{0,9}$/;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

/** Follows as the server accepts them from a browser: well-formed targets
 *  only, one per target, text trimmed to sane lengths, at most MAX_FOLLOWS.
 *  Anything malformed is dropped rather than rejected, so one odd item can't
 *  turn reminders off for the rest. */
export function cleanFollows(raw: unknown): Follow[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Follow[] = [];
  for (const x of raw) {
    const f = (x ?? {}) as Record<string, unknown>;
    const target = str(f.target, 40);
    if (!TARGET.test(target) || seen.has(target)) continue;
    seen.add(target);
    out.push({
      id: str(f.id, 64),
      name: str(f.name, 120) || target,
      target,
      progress: str(f.progress, 40),
    });
    if (out.length >= MAX_FOLLOWS) break;
  }
  return out;
}
