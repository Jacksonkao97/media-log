import { describe, expect, it } from "vitest";
import {
  addItem,
  filterItems,
  sortItems,
  updateItem,
  type Filters,
} from "./items";
import { emptyLibrary, normalise, type ItemFields } from "./schema";
import { sameItem } from "./sync/merge";

const fields = (over: Partial<ItemFields> = {}): ItemFields => ({
  name: "请回答1988",
  progress: "20",
  watch: "看完了",
  status: "完结",
  category: "电视剧",
  url: "",
  note: "",
  cast: "",
  year: undefined,
  ...over,
});
const none: Filters = {
  category: new Set(),
  status: new Set(),
  watch: new Set(),
};

describe("cast", () => {
  it("is kept when filled, in file order, and left out when empty", () => {
    const lib = addItem(
      emptyLibrary(),
      "韩国",
      fields({ cast: " 李惠利 " }),
    ).library;
    const it = lib.韩国.items[0];
    expect(it.cast).toBe("李惠利");
    expect(Object.keys(it).slice(-3)).toEqual([
      "cast",
      "createdAt",
      "updatedAt",
    ]);
    const plain = addItem(emptyLibrary(), "韩国", fields()).library.韩国
      .items[0];
    expect("cast" in plain).toBe(false);
  });

  it("is removed when the editor clears it", () => {
    const lib = addItem(
      emptyLibrary(),
      "韩国",
      fields({ cast: "李惠利" }),
    ).library;
    const id = lib.韩国.items[0].id;
    const after = updateItem(lib, "韩国", id, fields({ cast: "" }), "韩国")!;
    expect("cast" in after.library.韩国.items[0]).toBe(false);
  });

  it("survives a load, and old files load unchanged", () => {
    const raw = { items: [{ name: "a", cast: "朴宝剑" }, { name: "b" }] };
    const [a, b] = normalise(raw, "韩国").items;
    expect(a.cast).toBe("朴宝剑");
    expect("cast" in b).toBe(false);
  });

  it("is searchable and counts as a change for sync", () => {
    const lib = addItem(
      emptyLibrary(),
      "韩国",
      fields({ cast: "柳俊烈" }),
    ).library;
    const items = lib.韩国.items;
    expect(filterItems(items, "柳俊烈", none)).toHaveLength(1);
    expect(sameItem(items[0], { ...items[0], cast: "别人" })).toBe(false);
  });
});

describe("year", () => {
  it("is kept after category, and left out when unset", () => {
    const it = addItem(emptyLibrary(), "韩国", fields({ year: 2015 })).library
      .韩国.items[0];
    expect(it.year).toBe(2015);
    expect(Object.keys(it).slice(5, 8)).toEqual(["category", "year", "url"]);
    const plain = addItem(emptyLibrary(), "韩国", fields()).library.韩国
      .items[0];
    expect("year" in plain).toBe(false);
  });

  it("is removed when the editor clears it", () => {
    const lib = addItem(emptyLibrary(), "韩国", fields({ year: 2015 })).library;
    const id = lib.韩国.items[0].id;
    const after = updateItem(lib, "韩国", id, fields(), "韩国")!;
    expect("year" in after.library.韩国.items[0]).toBe(false);
  });

  it("loads from numbers or numeric strings, and drops anything else", () => {
    const raw = {
      items: [
        { name: "a", year: 2015 },
        { name: "b", year: "1999" },
        { name: "c", year: "去年" },
        { name: "d", year: 20.5 },
        { name: "e" },
      ],
    };
    const years = normalise(raw, "韩国").items.map((it) => it.year);
    expect(years).toEqual([2015, 1999, undefined, undefined, undefined]);
    expect("year" in normalise(raw, "韩国").items[4]).toBe(false);
  });

  it("sorts with unset years last both ways, is searchable, and syncs", () => {
    let lib = emptyLibrary();
    for (const [name, year] of [
      ["a", 2001],
      ["b", undefined],
      ["c", 2020],
    ] as const)
      lib = addItem(lib, "韩国", fields({ name, year })).library;
    const items = lib.韩国.items;
    const names = (dir: "asc" | "desc") =>
      sortItems(items, "year", dir).map((it) => it.name);
    expect(names("asc")).toEqual(["a", "c", "b"]);
    expect(names("desc")).toEqual(["c", "a", "b"]);
    expect(filterItems(items, "2020", none).map((it) => it.name)).toEqual([
      "c",
    ]);
    expect(sameItem(items[0], { ...items[0], year: 2002 })).toBe(false);
  });
});
