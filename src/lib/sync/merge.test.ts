import { describe, expect, it } from "vitest";
import type { Item, RegionFile } from "../schema";
import { mergeRegion } from "./merge";

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  name: `作品${id}`,
  progress: "1",
  watch: "看着",
  status: "未完结",
  category: "漫画",
  url: "",
  note: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});
const file = (...items: Item[]): RegionFile => ({
  region: "日本",
  version: 1,
  updatedAt: null,
  items,
});
const ids = (f: RegionFile) => f.items.map((it) => it.id);
const T1 = "2026-02-01T00:00:00Z";
const T2 = "2026-03-01T00:00:00Z";

describe("mergeRegion", () => {
  it("uploads local when Drive has no file yet", () => {
    const local = file(item("a"));
    const r = mergeRegion(null, local, null);
    expect(r.merged).toBe(local);
    expect(r).toMatchObject({ localChanged: false, remoteChanged: true });
  });

  it("downloads everything on a fresh device", () => {
    const remote = file(item("a"), item("b"));
    const r = mergeRegion(null, file(), remote);
    expect(r.merged).toBe(remote);
    expect(r).toMatchObject({
      localChanged: true,
      remoteChanged: false,
      pulled: { added: 2 },
    });
  });

  it("does nothing when both sides already match", () => {
    const base = file(item("a"));
    const r = mergeRegion(base, file(item("a")), file(item("a")));
    expect(r).toMatchObject({ localChanged: false, remoteChanged: false });
  });

  it("treats a different order as no change", () => {
    const r = mergeRegion(
      null,
      file(item("a"), item("b")),
      file(item("b"), item("a")),
    );
    expect(r).toMatchObject({ localChanged: false, remoteChanged: false });
  });

  it("keeps a local edit and uploads it", () => {
    const base = file(item("a"));
    const r = mergeRegion(
      base,
      file(item("a", { progress: "2", updatedAt: T1 })),
      base,
    );
    expect(r.merged.items[0].progress).toBe("2");
    expect(r).toMatchObject({ localChanged: false, remoteChanged: true });
  });

  it("takes a remote edit", () => {
    const base = file(item("a"));
    const r = mergeRegion(
      base,
      base,
      file(item("a", { progress: "9", updatedAt: T1 })),
    );
    expect(r.merged.items[0].progress).toBe("9");
    expect(r).toMatchObject({
      localChanged: true,
      remoteChanged: false,
      pulled: { updated: 1 },
    });
  });

  it("keeps edits to different items from both sides", () => {
    const base = file(item("a"), item("b"));
    const local = file(item("a", { progress: "2", updatedAt: T1 }), item("b"));
    const remote = file(item("a"), item("b", { progress: "5", updatedAt: T1 }));
    const r = mergeRegion(base, local, remote);
    expect(r.merged.items.map((it) => it.progress)).toEqual(["2", "5"]);
    expect(r).toMatchObject({ localChanged: true, remoteChanged: true });
  });

  it("lets the newer edit win when both sides edit the same item", () => {
    const base = file(item("a"));
    const older = item("a", { progress: "2", updatedAt: T1 });
    const newer = item("a", { progress: "3", updatedAt: T2 });
    expect(
      mergeRegion(base, file(newer), file(older)).merged.items[0].progress,
    ).toBe("3");
    expect(
      mergeRegion(base, file(older), file(newer)).merged.items[0].progress,
    ).toBe("3");
  });

  it("propagates a local delete", () => {
    const base = file(item("a"), item("b"));
    const r = mergeRegion(base, file(item("a")), base);
    expect(ids(r.merged)).toEqual(["a"]);
    expect(r).toMatchObject({ localChanged: false, remoteChanged: true });
  });

  it("applies a remote delete", () => {
    const base = file(item("a"), item("b"));
    const r = mergeRegion(base, base, file(item("a")));
    expect(ids(r.merged)).toEqual(["a"]);
    expect(r).toMatchObject({
      localChanged: true,
      remoteChanged: false,
      pulled: { removed: 1 },
    });
  });

  it("keeps a local edit over a remote delete", () => {
    const base = file(item("a"), item("b"));
    const local = file(item("a"), item("b", { note: "改了", updatedAt: T1 }));
    const r = mergeRegion(base, local, file(item("a")));
    expect(ids(r.merged)).toEqual(["a", "b"]);
    expect(r.remoteChanged).toBe(true);
  });

  it("keeps a remote edit over a local delete", () => {
    const base = file(item("a"), item("b"));
    const remote = file(item("a"), item("b", { note: "改了", updatedAt: T1 }));
    const r = mergeRegion(base, file(item("a")), remote);
    expect(ids(r.merged)).toEqual(["a", "b"]);
    expect(r.localChanged).toBe(true);
  });

  it("unions items added on each side, remote order first", () => {
    const base = file(item("a"));
    const r = mergeRegion(
      base,
      file(item("a"), item("l")),
      file(item("a"), item("r")),
    );
    expect(ids(r.merged)).toEqual(["a", "r", "l"]);
    expect(r).toMatchObject({
      localChanged: true,
      remoteChanged: true,
      pulled: { added: 1 },
    });
  });

  it("merges two devices that imported the same data and then diverged", () => {
    // First sync on the second device: no base, same ids on both sides.
    const local = file(
      item("a", { progress: "4", updatedAt: T2 }),
      item("b"),
      item("l"),
    );
    const remote = file(
      item("a", { progress: "3", updatedAt: T1 }),
      item("b", { note: "x", updatedAt: T1 }),
    );
    const r = mergeRegion(null, local, remote);
    const byId = Object.fromEntries(r.merged.items.map((it) => [it.id, it]));
    expect(byId.a.progress).toBe("4"); // newer local edit
    expect(byId.b.note).toBe("x"); // newer remote edit
    expect(byId.l).toBeDefined(); // local-only item kept
  });
});
