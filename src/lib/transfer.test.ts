import { describe, expect, it } from "vitest";
import { parseImport } from "./transfer";

const json = (v: unknown) => JSON.stringify(v);
const work = { name: "葬送的芙莉莲", progress: "28" };

describe("parseImport", () => {
  it("reads a region file, taking the region from the file", () => {
    const out = parseImport(
      json({ region: "日本", version: 1, items: [work] }),
      "backup.json",
    );
    expect(out.日本?.items.map((x) => x.name)).toEqual(["葬送的芙莉莲"]);
  });

  it("falls back to the filename for the region", () => {
    const out = parseImport(json([work]), "中国.json");
    expect(out.中国?.items).toHaveLength(1);
  });

  it("reads a snapshot", () => {
    const out = parseImport(
      json({ app: "MediaLog", regions: { 日本: [work], 韩国: [] } }),
      "medialog-20261009.json",
    );
    expect(out.日本?.items).toHaveLength(1);
    expect(out.韩国?.items).toEqual([]);
  });

  it("accepts an empty list (the confirm warns about it)", () => {
    expect(
      parseImport(json({ region: "日本", items: [] }), "x.json").日本,
    ).toMatchObject({ items: [] });
  });

  it("rejects text that isn't JSON", () => {
    expect(() => parseImport("hello", "notes.json")).toThrow(
      "notes.json 不是合法的 JSON",
    );
  });

  it("rejects a file whose region it can't tell", () => {
    expect(() => parseImport(json({ items: [work] }), "backup.json")).toThrow(
      "无法判断 backup.json 属于哪个区域",
    );
  });

  it("rejects items that aren't objects", () => {
    expect(() => parseImport(json([work, 1, "x"]), "日本.json")).toThrow(
      "日本.json 第 2 条不是作品",
    );
    expect(() => parseImport(json([[work]]), "日本.json")).toThrow(
      "日本.json 第 1 条不是作品",
    );
  });

  it("rejects items without a name", () => {
    expect(() =>
      parseImport(json([work, { progress: "3" }]), "日本.json"),
    ).toThrow("日本.json 第 2 条没有名称");
    expect(() => parseImport(json([{ name: "  " }]), "日本.json")).toThrow(
      "第 1 条没有名称",
    );
    expect(() => parseImport(json([{ name: 42 }]), "日本.json")).toThrow(
      "第 1 条没有名称",
    );
  });

  it("checks every region of a snapshot", () => {
    expect(() =>
      parseImport(
        json({ app: "MediaLog", regions: { 日本: [work], 中国: [{}] } }),
        "s.json",
      ),
    ).toThrow("s.json「中国」 第 1 条没有名称");
    expect(() =>
      parseImport(json({ app: "MediaLog", regions: { 日本: "x" } }), "s.json"),
    ).toThrow("s.json「日本」 不是作品列表");
  });
});
