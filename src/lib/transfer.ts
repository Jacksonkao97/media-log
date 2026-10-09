/* Import and export. Both formats from v1 are accepted on import:
 *   - a region file, data/{region}.json  ({ region, version, updatedAt, items })
 *   - a snapshot, medialog-YYYYMMDD.json ({ app: "MediaLog", regions: { 日本: [...] } })
 * The export is the same snapshot v1's 导出备份 produced. */

import {
  REGIONS,
  isRegion,
  normalise,
  nowIso,
  type Library,
  type RegionFile,
} from "./schema";

export type Imported = Partial<Record<RegionFile["region"], RegionFile>>;

/** Rejects a list that isn't works. normalise() fills in whatever is missing,
 *  so without this a stray number or a nameless object becomes a blank row. */
function checkItems(items: unknown, where: string) {
  if (!Array.isArray(items)) throw new Error(`${where} 不是作品列表`);
  items.forEach((x, i) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) {
      throw new Error(`${where} 第 ${i + 1} 条不是作品`);
    }
    const name = (x as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) {
      throw new Error(`${where} 第 ${i + 1} 条没有名称`);
    }
  });
}

/** Parses one file. The region comes from the file's own `region` field,
 *  falling back to its name (日本.json -> 日本). */
export function parseImport(text: string, filename: string): Imported {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${filename} 不是合法的 JSON`);
  }
  const obj = (data ?? {}) as Record<string, unknown>;

  if (
    obj.app === "MediaLog" &&
    obj.regions &&
    typeof obj.regions === "object"
  ) {
    const regions = obj.regions as Record<string, unknown>;
    const out: Imported = {};
    for (const r of REGIONS) {
      if (!(r in regions)) continue;
      const list = regions[r] as { items?: unknown } | null;
      checkItems(
        Array.isArray(list) ? list : list?.items,
        `${filename}「${r}」`,
      );
      out[r] = normalise(list, r);
    }
    if (!Object.keys(out).length) throw new Error(`${filename} 里没有任何区域`);
    return out;
  }

  const stem = filename.replace(/\.json$/i, "");
  const region = isRegion(obj.region)
    ? obj.region
    : isRegion(stem)
      ? stem
      : null;
  if (!region) throw new Error(`无法判断 ${filename} 属于哪个区域`);
  if (!Array.isArray(data) && !Array.isArray(obj.items)) {
    throw new Error(`${filename} 不是 MediaLog 的数据文件`);
  }
  checkItems(Array.isArray(data) ? data : obj.items, filename);
  return { [region]: normalise(data, region) };
}

export function snapshot(lib: Library) {
  return {
    app: "MediaLog",
    exportedAt: nowIso(),
    regions: Object.fromEntries(REGIONS.map((r) => [r, lib[r].items])),
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
