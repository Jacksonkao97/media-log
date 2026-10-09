/* Keeps several open tabs of the app consistent. They share IndexedDB (and
 * the sync base in it) but each holds its own library in memory, so a tab
 * that missed another tab's edit would save, or sync, its stale copy over it.
 * Every region a tab stores is therefore broadcast to the others, which adopt
 * it as-is (without saving or syncing it again). */

import type { Region, RegionFile } from "./schema";

type Message = { region: Region; file: RegionFile };

export function openTabChannel(
  onRegion: (region: Region, file: RegionFile) => void,
) {
  if (typeof BroadcastChannel === "undefined")
    return { announce: () => {}, close: () => {} };
  const channel = new BroadcastChannel("medialog");
  channel.onmessage = (ev: MessageEvent<Message>) =>
    onRegion(ev.data.region, ev.data.file);
  return {
    announce: (region: Region, file: RegionFile) =>
      channel.postMessage({ region, file } satisfies Message),
    close: () => channel.close(),
  };
}

/** Runs `fn` while holding a lock shared by all tabs, so only one tab syncs
 *  at a time (they share one sync base). Without Web Locks, just runs it. */
export async function withTabLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return fn();
  // TS types request() as Promise<Promise<T>>; awaiting unwraps it.
  return await navigator.locks.request(name, fn);
}
