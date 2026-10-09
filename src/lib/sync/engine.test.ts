import { describe, expect, it } from "vitest";
import {
  emptyLibrary,
  type Item,
  type Library,
  type Region,
  type RegionFile,
} from "../schema";
import {
  SyncEngine,
  type Remote,
  type RemoteFile,
  type RegionSync,
  type SyncStore,
} from "./engine";

/* An in-memory Drive folder. md5 is just a content hash, like Drive's. */
class FakeDrive implements Remote {
  files = new Map<string, { id: string; content: string }>();
  snapshots = new Map<string, string>();
  calls = { list: 0, read: 0, write: 0 };
  private nextId = 1;

  private meta(name: string): RemoteFile {
    const f = this.files.get(name)!;
    return { id: f.id, name, md5: hash(f.content) };
  }
  async list() {
    this.calls.list++;
    return new Map([...this.files.keys()].map((n) => [n, this.meta(n)]));
  }
  async read(file: RemoteFile) {
    this.calls.read++;
    return this.files.get(file.name)!.content;
  }
  async write(name: string, content: string, existing?: RemoteFile) {
    this.calls.write++;
    const id = existing?.id ?? `f${this.nextId++}`;
    this.files.set(name, { id, content });
    return this.meta(name);
  }
  async snapshot(name: string, content: string) {
    if (this.snapshots.has(name)) return false;
    this.snapshots.set(name, content);
    return true;
  }
  region(name: string): RegionFile {
    return JSON.parse(this.files.get(name)!.content);
  }
}

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.codePointAt(0)!) | 0;
  return String(h >>> 0);
};

/* One browser: its library plus its sync state. */
class Device {
  lib: Library = emptyLibrary();
  states = new Map<Region, RegionSync>();
  last: string | undefined;
  day = "2026-10-09";
  /** Runs once at the engine's next await on this device's store, to
   *  simulate the user editing while a sync is in flight. */
  duringSync: (() => void) | null = null;
  engine: SyncEngine;

  constructor(drive: Remote) {
    const store: SyncStore = {
      get: async (r) => this.states.get(r),
      set: async (r, s) => {
        this.states.set(r, s);
        const edit = this.duringSync;
        this.duringSync = null;
        edit?.();
      },
      lastSnapshot: async () => this.last,
      setLastSnapshot: async (d) => void (this.last = d),
    };
    this.engine = new SyncEngine({
      remote: drive,
      store,
      getLocal: () => this.lib,
      setLocal: (r, f) => {
        this.lib = { ...this.lib, [r]: f };
      },
      today: () => this.day,
    });
  }
  set(region: Region, ...items: Item[]) {
    this.lib = { ...this.lib, [region]: { ...this.lib[region], items } };
  }
  items(region: Region = "日本") {
    return this.lib[region].items;
  }
}

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

describe("SyncEngine", () => {
  it("uploads every region on the first sync and writes today's snapshot", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.set("日本", item("1"), item("2"));
    const report = await a.engine.sync();
    expect([...drive.files.keys()].sort()).toEqual(
      ["中国.json", "日本.json", "欧美.json", "韩国.json"].sort(),
    );
    expect(drive.region("日本.json").items.map((it) => it.id)).toEqual([
      "1",
      "2",
    ]);
    expect(report.snapshot).toBe("medialog-2026-10-09.json");
    expect(
      JSON.parse(drive.snapshots.get("medialog-2026-10-09.json")!).regions[
        "日本"
      ],
    ).toHaveLength(2);
  });

  it("writes files in v1's exact format", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.set("日本", item("1"));
    await a.engine.sync(["日本"]);
    const text = drive.files.get("日本.json")!.content;
    expect(text).toBe(JSON.stringify(a.lib["日本"], null, 2) + "\n");
  });

  it("downloads everything on a second device", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.set("日本", item("1"));
    a.set("韩国", item("k"));
    await a.engine.sync();
    const b = new Device(drive);
    const report = await b.engine.sync();
    expect(b.items().map((it) => it.id)).toEqual(["1"]);
    expect(b.items("韩国").map((it) => it.id)).toEqual(["k"]);
    expect(report.pulled.added).toBe(2);
    expect(report.pushed).toEqual([]);
  });

  it("carries edits and deletes between devices", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    a.set("日本", item("1"), item("2"), item("3"));
    await a.engine.sync();
    await b.engine.sync();

    a.set(
      "日本",
      item("1", { progress: "5", updatedAt: "2026-02-01T00:00:00Z" }),
      item("2"),
      item("3"),
    );
    b.set("日本", item("1"), item("2"), item("3"), item("4"));
    b.set("日本", ...b.items().filter((it) => it.id !== "3"));
    await a.engine.sync(["日本"]);
    await b.engine.sync(["日本"]);
    await a.engine.sync(["日本"]);

    for (const d of [a, b]) {
      expect(
        d
          .items()
          .map((it) => it.id)
          .sort(),
      ).toEqual(["1", "2", "4"]);
      expect(d.items().find((it) => it.id === "1")!.progress).toBe("5");
    }
  });

  it("does not download or upload when nothing changed", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.set("日本", item("1"));
    await a.engine.sync();
    drive.calls = { list: 0, read: 0, write: 0 };
    const report = await a.engine.sync();
    expect(drive.calls).toEqual({ list: 1, read: 0, write: 0 });
    expect(report).toMatchObject({ pushed: [], snapshot: null });
  });

  it("keeps an edit made while a sync was running", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    a.set("日本", item("1"), item("2"));
    await a.engine.sync();
    await b.engine.sync();
    b.set(
      "日本",
      item("1", { note: "远端", updatedAt: "2026-02-01T00:00:00Z" }),
      item("2"),
    );
    await b.engine.sync(["日本"]);

    // a pulls b's edit; just before it applies it, a's user edits item 2.
    a.duringSync = () =>
      a.set(
        "日本",
        item("1"),
        item("2", { progress: "9", updatedAt: "2026-03-01T00:00:00Z" }),
      );
    await a.engine.sync(["日本"]);

    const byId = Object.fromEntries(a.items().map((it) => [it.id, it]));
    expect(byId["1"].note).toBe("远端");
    expect(byId["2"].progress).toBe("9");
    // ...and the mid-sync edit reached Drive in the same call.
    expect(
      drive.region("日本.json").items.find((it) => it.id === "2")!.progress,
    ).toBe("9");
  });

  it("writes one snapshot per day", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    await a.engine.sync();
    await a.engine.sync();
    await b.engine.sync(); // another device the same day: name already taken
    expect([...drive.snapshots.keys()]).toEqual(["medialog-2026-10-09.json"]);
    a.day = "2026-10-10";
    await a.engine.sync();
    expect([...drive.snapshots.keys()]).toHaveLength(2);
  });

  it("records nothing as synced when an upload fails", async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.set("日本", item("1"));
    drive.write = async () => {
      throw new Error("offline");
    };
    await expect(a.engine.sync(["日本"])).rejects.toThrow("offline");
    expect(a.states.size).toBe(0);
  });

  it("rejects a corrupt remote file instead of overwriting it", async () => {
    const drive = new FakeDrive();
    drive.files.set("日本.json", { id: "x", content: "{ not json" });
    const a = new Device(drive);
    a.set("日本", item("1"));
    await expect(a.engine.sync(["日本"])).rejects.toThrow("不是合法的 JSON");
    expect(drive.files.get("日本.json")!.content).toBe("{ not json");
  });
});
