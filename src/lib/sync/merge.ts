/* Three-way merge of one region, the way git merges a file.
 *
 *   base   = the copy both sides agreed on at the last successful sync
 *   local  = this browser's copy now
 *   remote = the copy on Google Drive now
 *
 * Comparing each side against `base` tells us who changed what, so a phone and
 * a laptop can both edit offline and neither loses work. It also means
 * deletions propagate without tombstones: an item that is in `base` but gone
 * from one side was deleted there. The file format stays exactly v1's.
 *
 * Per item:
 *   - changed on one side only        → take that side
 *   - changed on both                 → the newer `updatedAt` wins (tie: remote)
 *   - deleted on one side, untouched  → delete
 *   - deleted on one side, edited on
 *     the other                       → keep the edit (losing an edit is worse
 *                                       than resurrecting a deleted row)
 *   - added on either side            → keep
 */

import { nowIso, type Item, type RegionFile } from "../schema";

const FIELDS = [
  "id",
  "name",
  "progress",
  "watch",
  "status",
  "category",
  "url",
  "note",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof Item)[];

export function sameItem(a: Item, b: Item): boolean {
  return FIELDS.every((k) => a[k] === b[k]);
}

/** Same items with the same content, in any order. */
export function sameItems(a: Item[], b: Item[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((it) => [it.id, it]));
  return a.every((it) => {
    const other = byId.get(it.id);
    return other !== undefined && sameItem(it, other);
  });
}

export interface MergeResult {
  /** What both sides should hold afterwards. */
  merged: RegionFile;
  /** The local copy must be replaced with `merged`. */
  localChanged: boolean;
  /** `merged` must be uploaded (or the remote file created). */
  remoteChanged: boolean;
  /** What arrived from the remote side, for the "synced" message. */
  pulled: { added: number; updated: number; removed: number };
}

export function mergeRegion(
  base: RegionFile | null,
  local: RegionFile,
  remote: RegionFile | null,
): MergeResult {
  const pulled = { added: 0, updated: 0, removed: 0 };
  if (!remote) {
    return { merged: local, localChanged: false, remoteChanged: true, pulled };
  }

  const B = new Map((base?.items ?? []).map((it) => [it.id, it]));
  const L = new Map(local.items.map((it) => [it.id, it]));
  const R = new Map(remote.items.map((it) => [it.id, it]));
  const changed = (side: Item | undefined, b: Item | undefined) =>
    side !== undefined && (b === undefined || !sameItem(side, b));

  const pick = (id: string): Item | null => {
    const b = B.get(id);
    const l = L.get(id);
    const r = R.get(id);
    const lc = changed(l, b);
    const rc = changed(r, b);

    if (l && r) {
      if (sameItem(l, r)) return l;
      if (lc && !rc) return l;
      if (rc && !lc) return (pulled.updated++, r);
      // Both changed (or there is no base yet): last writer wins.
      if (l.updatedAt > r.updatedAt) return l;
      return (pulled.updated++, r);
    }
    if (l) {
      if (!b || lc) return l; // added here, or edited here after the other side deleted it
      return (pulled.removed++, null); // deleted remotely
    }
    if (r) {
      if (!b) return (pulled.added++, r); // added remotely
      if (rc) return (pulled.added++, r); // deleted here, but edited remotely: keep the edit
      return null; // deleted here
    }
    return null;
  };

  // Remote order first, then anything only this side has, in local order.
  const items: Item[] = [];
  for (const it of remote.items) {
    const kept = pick(it.id);
    if (kept) items.push(kept);
  }
  for (const it of local.items) {
    if (R.has(it.id)) continue;
    const kept = pick(it.id);
    if (kept) items.push(kept);
  }

  const localChanged = !sameItems(items, local.items);
  const remoteChanged = !sameItems(items, remote.items);
  // Keep whichever side's exact file (order, timestamps) already matches, so
  // a no-op sync never rewrites anything.
  const merged: RegionFile = !localChanged
    ? local
    : !remoteChanged
      ? remote
      : { ...local, updatedAt: nowIso(), items };

  return { merged, localChanged, remoteChanged, pulled };
}
