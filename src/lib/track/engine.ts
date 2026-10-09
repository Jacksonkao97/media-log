/* One round of 更新提醒, run by a scheduler hitting /api/track/check:
 *
 *   1. Anime: one AniList request for every followed show's episodes aired
 *      since the last round (at most two days back). Notify the newest
 *      episode of each, once.
 *   2. Manga: fetch manhuagui pages, least recently checked first, each at
 *      most every `mangaEveryMs` (6 h), within a time budget, a few at a time.
 *      The first look at a comic only records its newest chapter, so turning
 *      reminders on doesn't announce 100 "updates".
 *   3. Save what was seen, then notify every device following an update; a
 *      device with more than three updates gets one summary instead.
 *
 * State is saved before sending, so a failed send is lost rather than
 * repeated every round. The sources, the store and the sender are passed in,
 * which keeps this free of network code and testable with fakes. */

import type { Comic } from "./manhuagui";
import type { Aired } from "./episodes";
import type { PushMessage } from "./push";
import type { PushSub, Subscriber, TargetState, TrackStore } from "./store";
import { isAnime, targetId, targetUrl, type Follow } from "./targets";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface CheckDeps {
  store: TrackStore;
  aired: (ids: number[], from: number, to: number) => Promise<Aired[]>;
  comic: (id: number) => Promise<Comic>;
  send: (sub: PushSub, msg: PushMessage) => Promise<"sent" | "gone">;
  /** Unix ms; defaults to Date.now(). */
  now?: number;
  /** Milliseconds since the round started, for the budget. */
  elapsed?: () => number;
  /** Stop starting manga checks after this long. Defaults to 40 s, inside
   *  the 60 s a serverless function typically gets. */
  budgetMs?: number;
  mangaEveryMs?: number;
  concurrency?: number;
}

export interface CheckReport {
  devices: number;
  anime: { followed: number; newEpisodes: number; error?: string };
  manga: {
    followed: number;
    checked: number;
    failed: number;
    /** Checked recently enough to skip, or left for the next round. */
    later: number;
    newChapters: number;
  };
  notifications: { sent: number; failed: number; removedDevices: number };
}

interface Update {
  target: string;
  text: string;
}

const message = (f: Follow, u: Update): PushMessage => ({
  title: f.name,
  body: f.progress ? `${u.text} · 你看到 ${f.progress}` : u.text,
  url: targetUrl(u.target),
  tag: u.target,
});

function summary(names: string[]): PushMessage {
  const shown = names.slice(0, 5).join("、");
  return {
    title: `${names.length} 部作品有更新`,
    body: names.length > 5 ? `${shown} 等` : shown,
    url: "/",
    tag: "medialog-updates",
  };
}

export async function runCheck(deps: CheckDeps): Promise<CheckReport> {
  const { store } = deps;
  const now = deps.now ?? Date.now();
  const t0 = Date.now();
  const elapsed = deps.elapsed ?? (() => Date.now() - t0);
  const budget = deps.budgetMs ?? 40_000;
  const every = deps.mangaEveryMs ?? 6 * HOUR;

  const subs = await store.subscribers();
  const followers = new Map<string, { sub: Subscriber; follow: Follow }[]>();
  for (const sub of subs)
    for (const follow of sub.follows) {
      const list = followers.get(follow.target) ?? [];
      list.push({ sub, follow });
      followers.set(follow.target, list);
    }
  const targets = [...followers.keys()];
  const states = await store.states();
  const changed: Record<string, TargetState> = {};
  const updates: Update[] = [];

  /* ---------------------------------------------------------- anime */
  const anime = targets.filter(isAnime);
  const report: CheckReport = {
    devices: subs.length,
    anime: { followed: anime.length, newEpisodes: 0 },
    manga: {
      followed: targets.length - anime.length,
      checked: 0,
      failed: 0,
      later: 0,
      newChapters: 0,
    },
    notifications: { sent: 0, failed: 0, removedDevices: 0 },
  };
  let animeOk = true;
  if (anime.length) {
    const last = (await store.lastRun()) ?? now - HOUR;
    const from = Math.floor(Math.max(last, now - 2 * DAY) / 1000);
    try {
      const aired = await deps.aired(
        anime.map(targetId),
        from,
        Math.floor(now / 1000),
      );
      const newest = new Map<string, number>();
      for (const a of aired) {
        const t = `anilist:${a.mediaId}`;
        newest.set(t, Math.max(newest.get(t) ?? 0, a.episode));
      }
      for (const [t, episode] of newest) {
        if (!followers.has(t) || episode <= (states[t]?.episode ?? 0)) continue;
        changed[t] = { checkedAt: now, episode };
        updates.push({ target: t, text: `第 ${episode} 集已播出` });
        report.anime.newEpisodes++;
      }
    } catch (err) {
      animeOk = false;
      report.anime.error = (err as Error).message;
    }
  }

  /* ---------------------------------------------------------- manga */
  const manga = targets.filter((t) => !isAnime(t));
  const due = manga
    .filter((t) => !states[t] || now - states[t].checkedAt >= every)
    .sort((a, b) => (states[a]?.checkedAt ?? 0) - (states[b]?.checkedAt ?? 0));
  let next = 0;
  const worker = async () => {
    while (next < due.length && elapsed() < budget) {
      const t = due[next++];
      const prev = states[t];
      try {
        const c = await deps.comic(targetId(t));
        report.manga.checked++;
        if (prev?.latestId && c.latestId > prev.latestId) {
          updates.push({ target: t, text: `更新至 ${c.latest}` });
          report.manga.newChapters++;
        }
        // A chapter taken down doesn't lower the mark, so it isn't
        // announced again when it comes back.
        changed[t] =
          prev?.latestId && c.latestId < prev.latestId
            ? { ...prev, checkedAt: now, error: undefined }
            : { checkedAt: now, latestId: c.latestId, latest: c.latest };
      } catch (err) {
        report.manga.failed++;
        changed[t] = {
          ...prev,
          checkedAt: now,
          error: (err as Error).message,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: deps.concurrency ?? 3 }, worker));
  report.manga.later =
    report.manga.followed - report.manga.checked - report.manga.failed;

  /* ----------------------------------------------------------- save */
  const drop = Object.keys(states).filter((t) => !followers.has(t));
  await store.saveStates(changed, drop);
  if (animeOk) await store.setLastRun(now);

  /* --------------------------------------------------------- notify */
  const perDevice = new Map<string, { sub: Subscriber; msgs: PushMessage[] }>();
  for (const u of updates)
    for (const { sub, follow } of followers.get(u.target) ?? []) {
      const entry = perDevice.get(sub.id) ?? { sub, msgs: [] };
      entry.msgs.push(message(follow, u));
      perDevice.set(sub.id, entry);
    }
  for (const { sub, msgs } of perDevice.values()) {
    const out = msgs.length > 3 ? [summary(msgs.map((m) => m.title))] : msgs;
    for (const msg of out) {
      try {
        if ((await deps.send(sub.sub, msg)) === "gone") {
          await store.removeSubscriber(sub.id);
          report.notifications.removedDevices++;
          break;
        }
        report.notifications.sent++;
      } catch {
        report.notifications.failed++;
      }
    }
  }
  return report;
}
