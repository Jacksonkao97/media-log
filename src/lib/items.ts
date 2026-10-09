/* Pure list logic: filtering, sorting and the edits the dialog makes. Edits
 * return a new Library plus the regions they touched, so storage (and later
 * Drive sync) only rewrites the files that actually changed. */

import {
  CATEGORIES,
  STATUSES,
  WATCHES,
  nowIso,
  uuid,
  type Category,
  type Item,
  type ItemFields,
  type Library,
  type Region,
  type Status,
  type Watch,
} from "./schema";

export type SortKey =
  "name" | "progress" | "status" | "category" | "createdAt" | "updatedAt";
export type SortDir = "asc" | "desc";

export interface Filters {
  category: Set<Category>;
  status: Set<Status>;
  watch: Set<Watch>;
}

const rank =
  <T extends string>(list: readonly T[]) =>
  (v: T) =>
    list.indexOf(v);
const RANK = {
  status: rank(STATUSES),
  category: rank(CATEGORIES),
  watch: rank(WATCHES),
};

const COLLATOR = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});

/** First number inside a free-form progress string ("第41卷" -> 41). */
export function progNum(p: string): number | null {
  const m = p.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function compare(a: Item, b: Item, key: SortKey): number {
  switch (key) {
    case "name":
      return COLLATOR.compare(a.name, b.name);
    case "progress": {
      const x = progNum(a.progress);
      const y = progNum(b.progress);
      if (x !== null && y !== null && x !== y) return x - y;
      return RANK.watch(a.watch) - RANK.watch(b.watch);
    }
    case "status":
      return RANK.status(a.status) - RANK.status(b.status);
    case "category":
      return RANK.category(a.category) - RANK.category(b.category);
    case "createdAt":
    case "updatedAt":
      return a[key].localeCompare(b[key]);
  }
}

export function sortItems(items: Item[], key: SortKey, dir: SortDir): Item[] {
  const sign = dir === "asc" ? 1 : -1;
  return items.slice().sort((a, b) => {
    // Rows with no numeric progress stay at the bottom in both directions.
    if (key === "progress") {
      const x = progNum(a.progress);
      const y = progNum(b.progress);
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
    }
    return sign * compare(a, b, key) || COLLATOR.compare(a.name, b.name);
  });
}

export function filterItems(items: Item[], q: string, f: Filters): Item[] {
  const needle = q.trim().toLowerCase();
  return items.filter(
    (it) =>
      (!f.category.size || f.category.has(it.category)) &&
      (!f.status.size || f.status.has(it.status)) &&
      (!f.watch.size || f.watch.has(it.watch)) &&
      (!needle ||
        it.name.toLowerCase().includes(needle) ||
        it.note.toLowerCase().includes(needle)),
  );
}

/* ----------------------------------------------------------------- edits */

export interface Edit {
  library: Library;
  touched: Region[];
}

function withItems(lib: Library, region: Region, items: Item[]): Library {
  return {
    ...lib,
    [region]: { ...lib[region], updatedAt: nowIso(), items },
  };
}

export function addItem(
  lib: Library,
  region: Region,
  fields: ItemFields,
): Edit {
  const ts = nowIso();
  const item: Item = { id: uuid(), ...fields, createdAt: ts, updatedAt: ts };
  return {
    library: withItems(lib, region, [...lib[region].items, item]),
    touched: [region],
  };
}

/** Saves the dialog. A different target region moves the item between files. */
export function updateItem(
  lib: Library,
  from: Region,
  id: string,
  fields: ItemFields,
  to: Region,
): Edit | null {
  const old = lib[from].items.find((x) => x.id === id);
  if (!old) return null;
  const updated: Item = { ...old, ...fields, updatedAt: nowIso() };

  if (to === from) {
    const items = lib[from].items.map((x) => (x.id === id ? updated : x));
    return { library: withItems(lib, from, items), touched: [from] };
  }
  const removed = withItems(
    lib,
    from,
    lib[from].items.filter((x) => x.id !== id),
  );
  return {
    library: withItems(removed, to, [...lib[to].items, updated]),
    touched: [from, to],
  };
}

export function deleteItem(lib: Library, region: Region, id: string): Edit {
  return {
    library: withItems(
      lib,
      region,
      lib[region].items.filter((x) => x.id !== id),
    ),
    touched: [region],
  };
}

/** "第41卷" -> "第42卷", "125" -> "126". Null when there is no number to bump. */
export function bumpProgress(progress: string): string | null {
  const m = progress.match(/\d+(?:\.\d+)?/);
  if (!m || m.index === undefined) return null;
  const next = String(parseFloat(m[0]) + 1);
  return (
    progress.slice(0, m.index) + next + progress.slice(m.index + m[0].length)
  );
}

/** The +1 button. Bumping something marked 未看 means you have started it. */
export function bumpItem(
  lib: Library,
  region: Region,
  id: string,
): Edit | null {
  const it = lib[region].items.find((x) => x.id === id);
  const progress = it && bumpProgress(it.progress);
  if (!it || !progress) return null;
  const updated: Item = {
    ...it,
    progress,
    watch: it.watch === "未看" ? "看着" : it.watch,
    updatedAt: nowIso(),
  };
  const items = lib[region].items.map((x) => (x.id === id ? updated : x));
  return { library: withItems(lib, region, items), touched: [region] };
}

/** Undo for a bump or a delete: puts the exact previous version of an item
 *  back, at its old position, without disturbing anything edited since. */
export function restoreItem(
  lib: Library,
  region: Region,
  item: Item,
  index: number,
): Edit {
  const items = lib[region].items.filter((x) => x.id !== item.id);
  items.splice(Math.min(index, items.length), 0, item);
  return { library: withItems(lib, region, items), touched: [region] };
}
