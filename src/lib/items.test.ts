import { describe, expect, it } from "vitest";
import { addItem, filterItems, updateItem, type Filters } from "./items";
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
