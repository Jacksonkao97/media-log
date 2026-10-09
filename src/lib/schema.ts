/* The data model. Every allowed value lives here; the UI, sorting and import
 * code all read from these lists, so adding a value is a one-file change
 * (plus a colour in components/Pill.tsx).
 *
 * The on-disk shape — data/{region}.json, the Drive backups and the snapshot
 * export — is unchanged from v1, so old files import as-is. */

export const REGIONS = ["日本", "中国", "韩国", "欧美"] as const;
export const CATEGORIES = ["动画", "漫画", "电影"] as const;
export const STATUSES = ["未完结", "完结"] as const;
export const WATCHES = ["未看", "看着", "看完了"] as const;

export type Region = (typeof REGIONS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type Watch = (typeof WATCHES)[number];

export interface Item {
  id: string;
  name: string;
  /** Free text: "125", "第41卷", "剧场版", "156分钟". Sorting reads the first number. */
  progress: string;
  watch: Watch;
  status: Status;
  category: Category;
  url: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** One data/{region}.json file. */
export interface RegionFile {
  region: Region;
  version: number;
  updatedAt: string | null;
  items: Item[];
}

export type Library = Record<Region, RegionFile>;

/** The fields the edit dialog owns. */
export type ItemFields = Omit<Item, "id" | "createdAt" | "updatedAt">;

export const isRegion = (v: unknown): v is Region =>
  REGIONS.includes(v as Region);

const oneOf = <T extends string>(
  list: readonly T[],
  v: unknown,
  fallback: T,
) => (list.includes(v as T) ? (v as T) : fallback);

export const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

/** crypto.randomUUID only exists in secure contexts; testing from a phone over
 *  plain http on the LAN is not one, so fall back to getRandomValues. */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const emptyRegion = (region: Region): RegionFile => ({
  region,
  version: 1,
  updatedAt: null,
  items: [],
});

export const emptyLibrary = (): Library =>
  Object.fromEntries(REGIONS.map((r) => [r, emptyRegion(r)])) as Library;

/** The schema gate: anything read from storage or an imported file passes
 *  through here. Unknown enum values fall back to defaults, missing ids and
 *  timestamps are filled in. Key order matches tools/migrate.py so a
 *  load-then-save never rewrites a file as a no-op diff. */
export function normalise(raw: unknown, region: Region): RegionFile {
  const obj = (raw ?? {}) as Partial<RegionFile>;
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(obj.items)
      ? obj.items
      : [];
  return {
    region,
    version: obj.version ?? 1,
    updatedAt: obj.updatedAt ?? null,
    items: items.map((x) => {
      const it = (x ?? {}) as Partial<Record<keyof Item, unknown>>;
      const createdAt =
        typeof it.createdAt === "string" ? it.createdAt : nowIso();
      return {
        id: typeof it.id === "string" && it.id ? it.id : uuid(),
        name: String(it.name ?? ""),
        progress: String(it.progress ?? ""),
        watch: oneOf(WATCHES, it.watch, "看着"),
        status: oneOf(STATUSES, it.status, "未完结"),
        category: oneOf(CATEGORIES, it.category, "动画"),
        url: String(it.url ?? ""),
        note: String(it.note ?? ""),
        createdAt,
        updatedAt: typeof it.updatedAt === "string" ? it.updatedAt : createdAt,
      };
    }),
  };
}
