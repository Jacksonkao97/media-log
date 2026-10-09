import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FileStore,
  UpstashStore,
  storeKind,
  type Subscriber,
  type TrackStore,
} from "./store";

const sub = (id: string): Subscriber => ({
  id,
  sub: {
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    keys: { p256dh: "p", auth: "a" },
  },
  follows: [
    { id: "i", name: "全知读者视角", target: "manhuagui:1", progress: "125" },
  ],
  updatedAt: 1,
});

/** The behaviour both stores must share. */
async function exercise(store: TrackStore) {
  expect(await store.subscribers()).toEqual([]);
  expect(await store.lastRun()).toBeNull();
  await store.saveSubscriber(sub("a"));
  await store.saveSubscriber(sub("b"));
  await store.saveSubscriber({ ...sub("a"), updatedAt: 2 });
  expect(await store.countSubscribers()).toBe(2);
  expect((await store.subscriber("a"))?.updatedAt).toBe(2);
  expect(await store.subscriber("zz")).toBeNull();
  await store.removeSubscriber("b");
  expect((await store.subscribers()).map((s) => s.id)).toEqual(["a"]);

  await store.saveStates(
    {
      "manhuagui:1": { checkedAt: 5, latestId: 9, latest: "第9话" },
      "anilist:2": { checkedAt: 5, episode: 3 },
    },
    [],
  );
  await store.saveStates({ "anilist:2": { checkedAt: 6, episode: 4 } }, [
    "manhuagui:1",
  ]);
  expect(await store.states()).toEqual({
    "anilist:2": { checkedAt: 6, episode: 4 },
  });
  await store.setLastRun(123);
  expect(await store.lastRun()).toBe(123);
}

describe("FileStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "track-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("keeps everything in one JSON file", async () => {
    const file = path.join(dir, "sub", "track.json");
    await exercise(new FileStore(file));
    const saved = JSON.parse(await readFile(file, "utf8"));
    expect(Object.keys(saved)).toEqual(["subscribers", "states", "lastRun"]);
    // A second instance (another process, a restart) sees the same data.
    expect(await new FileStore(file).lastRun()).toBe(123);
  });

  it("doesn't lose concurrent writes", async () => {
    const store = new FileStore(path.join(dir, "t.json"));
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.saveSubscriber(sub(`s${i}`))),
    );
    expect(await store.countSubscribers()).toBe(20);
  });
});

describe("UpstashStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("speaks the REST pipeline API", async () => {
    // A tiny Redis: just the commands the store uses.
    const hashes = new Map<string, Map<string, string>>();
    const strings = new Map<string, string>();
    const h = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(url).toBe("https://x.upstash.io/pipeline");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer tok",
      );
      const cmds = JSON.parse(init.body as string) as string[][];
      calls.push(cmds);
      const results = cmds.map(([cmd, key, ...args]) => {
        switch (cmd) {
          case "HSET":
            for (let i = 0; i < args.length; i += 2)
              h(key).set(args[i], args[i + 1]);
            return args.length / 2;
          case "HGET":
            return h(key).get(args[0]) ?? null;
          case "HDEL":
            return args.filter((f) => h(key).delete(f)).length;
          case "HVALS":
            return [...h(key).values()];
          case "HLEN":
            return h(key).size;
          case "HGETALL":
            return [...h(key)].flat();
          case "GET":
            return strings.get(key) ?? null;
          case "SET":
            strings.set(key, String(args[0]));
            return "OK";
        }
        return { error: `unknown ${cmd}` };
      });
      return new Response(
        JSON.stringify(results.map((result) => ({ result }))),
      );
    });
    await exercise(new UpstashStore("https://x.upstash.io/", "tok"));
    // Writing several states is one HSET.
    expect(calls).toContainEqual([
      [
        "HSET",
        "medialog:state",
        "anilist:2",
        JSON.stringify({ checkedAt: 6, episode: 4 }),
      ],
      ["HDEL", "medialog:state", "manhuagui:1"],
    ]);
  });

  it("surfaces Redis errors", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify([{ error: "WRONGPASS" }])),
    );
    await expect(new UpstashStore("https://x", "t").lastRun()).rejects.toThrow(
      "Upstash 出错：WRONGPASS",
    );
  });
});

describe("storeKind", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Upstash when configured, under either name", () => {
    vi.stubEnv("KV_REST_API_URL", "https://x");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    expect(storeKind()).toBe("upstash");
  });

  it("falls back to a file, except on serverless hosts", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("VERCEL", "");
    expect(storeKind()).toBe("file");
    vi.stubEnv("VERCEL", "1");
    expect(storeKind()).toBeNull();
  });
});
