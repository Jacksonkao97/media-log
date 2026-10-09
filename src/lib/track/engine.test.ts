import { describe, expect, it } from "vitest";
import { runCheck, type CheckDeps } from "./engine";
import type { Comic } from "./manhuagui";
import type { PushMessage } from "./push";
import type { PushSub, Subscriber, TargetState, TrackStore } from "./store";
import type { Follow } from "./targets";

/** An in-memory TrackStore. */
class MemoryStore implements TrackStore {
  subs = new Map<string, Subscriber>();
  state: Record<string, TargetState> = {};
  last: number | null = null;
  async subscribers() {
    return [...this.subs.values()];
  }
  async subscriber(id: string) {
    return this.subs.get(id) ?? null;
  }
  async saveSubscriber(s: Subscriber) {
    this.subs.set(s.id, s);
  }
  async removeSubscriber(id: string) {
    this.subs.delete(id);
  }
  async countSubscribers() {
    return this.subs.size;
  }
  async states() {
    return structuredClone(this.state);
  }
  async saveStates(changed: Record<string, TargetState>, drop: string[]) {
    Object.assign(this.state, structuredClone(changed));
    for (const t of drop) delete this.state[t];
  }
  async lastRun() {
    return this.last;
  }
  async setLastRun(ms: number) {
    this.last = ms;
  }
}

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 9, 9, 12);

const follow = (target: string, name: string, progress = ""): Follow => ({
  id: `item-${target}`,
  name,
  target,
  progress,
});

const device = (id: string, follows: Follow[]): Subscriber => ({
  id,
  sub: {
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    keys: { p256dh: "p", auth: "a" },
  },
  follows,
  updatedAt: 0,
});

function setup(over: Partial<CheckDeps> = {}) {
  const store = new MemoryStore();
  const comics: Record<number, Comic> = {};
  const sent: { to: string; msg: PushMessage }[] = [];
  const fetched: number[] = [];
  const gone = new Set<string>();
  const deps: CheckDeps = {
    store,
    now: NOW,
    aired: async () => [],
    comic: async (id) => {
      fetched.push(id);
      if (!comics[id]) throw new Error("页面里找不到章节列表");
      return comics[id];
    },
    send: async (sub: PushSub, msg) => {
      if (gone.has(sub.endpoint)) return "gone";
      sent.push({ to: sub.endpoint.split("/").pop()!, msg });
      return "sent";
    },
    ...over,
  };
  return { store, comics, sent, fetched, gone, deps };
}

describe("runCheck: manga", () => {
  it("records a comic the first time, and notifies only when it moves on", async () => {
    const t = setup();
    t.store.subs.set(
      "a",
      device("a", [follow("manhuagui:7", "全知读者视角", "125")]),
    );
    t.comics[7] = { latestId: 100, latest: "第125话", chapters: 125 };

    let report = await runCheck(t.deps);
    expect(t.sent).toEqual([]);
    expect(t.store.state["manhuagui:7"]).toEqual({
      checkedAt: NOW,
      latestId: 100,
      latest: "第125话",
    });
    expect(report.manga).toMatchObject({ checked: 1, newChapters: 0 });

    // Not due again for six hours.
    t.comics[7] = { latestId: 101, latest: "第126话", chapters: 126 };
    report = await runCheck({ ...t.deps, now: NOW + HOUR });
    expect(t.fetched).toEqual([7]);
    expect(report.manga.later).toBe(1);

    report = await runCheck({ ...t.deps, now: NOW + 6 * HOUR });
    expect(t.sent).toEqual([
      {
        to: "a",
        msg: {
          title: "全知读者视角",
          body: "更新至 第126话 · 你看到 125",
          url: "https://www.manhuagui.com/comic/7/",
          tag: "manhuagui:7",
        },
      },
    ]);
    expect(report.manga.newChapters).toBe(1);
  });

  it("checks the least recently checked first, within the budget", async () => {
    let ms = 0;
    const t = setup({
      budgetMs: 2500,
      concurrency: 1,
      elapsed: () => ms,
    });
    const slow = t.deps.comic;
    t.deps.comic = async (id) => {
      ms += 1000;
      return slow(id);
    };
    t.store.subs.set(
      "a",
      device(
        "a",
        [1, 2, 3, 4].map((n) => follow(`manhuagui:${n}`, `c${n}`)),
      ),
    );
    for (const n of [1, 2, 3, 4])
      t.comics[n] = { latestId: n, latest: `#${n}`, chapters: 1 };
    t.store.state["manhuagui:1"] = { checkedAt: NOW - 7 * HOUR, latestId: 1 };
    t.store.state["manhuagui:2"] = { checkedAt: NOW - 9 * HOUR, latestId: 2 };

    const report = await runCheck(t.deps);
    // Never-checked (3, 4) first, then the oldest (2); out of time before 1.
    expect(t.fetched).toEqual([3, 4, 2]);
    expect(report.manga).toMatchObject({ checked: 3, later: 1 });
  });

  it("records a failure and tries again next time, keeping what it knew", async () => {
    const t = setup();
    t.store.subs.set("a", device("a", [follow("manhuagui:9", "x")]));
    t.store.state["manhuagui:9"] = {
      checkedAt: NOW - 7 * HOUR,
      latestId: 50,
      latest: "第50话",
    };
    const report = await runCheck(t.deps);
    expect(report.manga.failed).toBe(1);
    expect(t.store.state["manhuagui:9"]).toEqual({
      checkedAt: NOW,
      latestId: 50,
      latest: "第50话",
      error: "页面里找不到章节列表",
    });
  });

  it("doesn't lower the mark when a chapter disappears", async () => {
    const t = setup();
    t.store.subs.set("a", device("a", [follow("manhuagui:9", "x")]));
    t.store.state["manhuagui:9"] = {
      checkedAt: 0,
      latestId: 50,
      latest: "第50话",
    };
    t.comics[9] = { latestId: 49, latest: "第49话", chapters: 49 };
    await runCheck(t.deps);
    expect(t.store.state["manhuagui:9"]).toMatchObject({
      latestId: 50,
      checkedAt: NOW,
    });
    t.comics[9] = { latestId: 50, latest: "第50话", chapters: 50 };
    await runCheck({ ...t.deps, now: NOW + 7 * HOUR });
    expect(t.sent).toEqual([]);
  });
});

describe("runCheck: anime", () => {
  it("asks for episodes since the last round, and notifies the newest once", async () => {
    const calls: [number[], number, number][] = [];
    const t = setup({
      aired: async (ids, from, to) => {
        calls.push([ids, from, to]);
        return [
          { mediaId: 21, episode: 5, airingAt: to - 600 },
          { mediaId: 21, episode: 6, airingAt: to - 300 },
          { mediaId: 99, episode: 1, airingAt: to - 300 }, // not followed
        ];
      },
    });
    t.store.subs.set(
      "a",
      device("a", [follow("anilist:21", "葬送的芙莉莲", "4")]),
    );
    t.store.last = NOW - 30 * 60_000;

    await runCheck(t.deps);
    expect(calls).toEqual([[[21], (NOW - 30 * 60_000) / 1000, NOW / 1000]]);
    expect(t.sent.map((s) => s.msg)).toEqual([
      {
        title: "葬送的芙莉莲",
        body: "第 6 集已播出 · 你看到 4",
        url: "/",
        tag: "anilist:21",
      },
    ]);
    expect(t.store.last).toBe(NOW);

    // The same episodes again (overlapping window): nothing new.
    await runCheck({ ...t.deps, now: NOW + 60_000 });
    expect(t.sent).toHaveLength(1);
  });

  it("looks back at most two days, and an hour on the first round", async () => {
    const froms: number[] = [];
    const t = setup({
      aired: async (_ids, from) => {
        froms.push(from);
        return [];
      },
    });
    t.store.subs.set("a", device("a", [follow("anilist:1", "x")]));
    await runCheck(t.deps);
    t.store.last = NOW - 30 * 24 * HOUR;
    await runCheck(t.deps);
    expect(froms).toEqual([(NOW - HOUR) / 1000, (NOW - 48 * HOUR) / 1000]);
  });

  it("keeps the window when AniList fails, so nothing is skipped", async () => {
    const t = setup({
      aired: async () => {
        throw new Error("AniList 请求太频繁，请稍后再试");
      },
    });
    t.store.subs.set("a", device("a", [follow("anilist:1", "x")]));
    t.store.last = NOW - HOUR;
    const report = await runCheck(t.deps);
    expect(report.anime.error).toBe("AniList 请求太频繁，请稍后再试");
    expect(t.store.last).toBe(NOW - HOUR);
  });

  it("doesn't ask AniList when no anime is followed", async () => {
    let asked = false;
    const t = setup({
      aired: async () => {
        asked = true;
        return [];
      },
    });
    await runCheck(t.deps);
    expect(asked).toBe(false);
  });
});

describe("runCheck: notifying", () => {
  it("tells every device that follows an update, with its own names", async () => {
    const t = setup({
      aired: async () => [
        { mediaId: 1, episode: 2, airingAt: NOW / 1000 - 60 },
      ],
    });
    t.store.subs.set("a", device("a", [follow("anilist:1", "芙莉莲")]));
    t.store.subs.set("b", device("b", [follow("anilist:1", "Frieren", "1")]));
    t.store.subs.set("c", device("c", [follow("anilist:2", "other")]));
    await runCheck(t.deps);
    expect(t.sent.map((s) => [s.to, s.msg.title, s.msg.body])).toEqual([
      ["a", "芙莉莲", "第 2 集已播出"],
      ["b", "Frieren", "第 2 集已播出 · 你看到 1"],
    ]);
  });

  it("sums up more than three updates in one notification", async () => {
    const t = setup({
      aired: async () =>
        [1, 2, 3, 4, 5, 6].map((id) => ({
          mediaId: id,
          episode: 1,
          airingAt: NOW / 1000 - 60,
        })),
    });
    t.store.subs.set(
      "a",
      device(
        "a",
        [1, 2, 3, 4, 5, 6].map((id) => follow(`anilist:${id}`, `番${id}`)),
      ),
    );
    await runCheck(t.deps);
    expect(t.sent.map((s) => s.msg)).toEqual([
      {
        title: "6 部作品有更新",
        body: "番1、番2、番3、番4、番5 等",
        url: "/",
        tag: "medialog-updates",
      },
    ]);
  });

  it("forgets devices whose subscription is gone, and targets nobody follows", async () => {
    const t = setup({
      aired: async () => [
        { mediaId: 1, episode: 3, airingAt: NOW / 1000 - 60 },
      ],
    });
    t.store.subs.set("a", device("a", [follow("anilist:1", "x")]));
    t.store.state["manhuagui:404"] = { checkedAt: 0, latestId: 1 };
    t.gone.add("https://fcm.googleapis.com/fcm/send/a");
    const report = await runCheck(t.deps);
    expect(report.notifications.removedDevices).toBe(1);
    expect(t.store.subs.size).toBe(0);
    expect(Object.keys(t.store.state)).toEqual(["anilist:1"]);
  });

  it("counts a failed send and carries on", async () => {
    const t = setup({
      aired: async () => [
        { mediaId: 1, episode: 1, airingAt: NOW / 1000 - 60 },
        { mediaId: 2, episode: 1, airingAt: NOW / 1000 - 60 },
      ],
    });
    let n = 0;
    t.deps.send = async () => {
      if (n++ === 0) throw new Error("推送失败（500）");
      return "sent";
    };
    t.store.subs.set(
      "a",
      device("a", [follow("anilist:1", "x"), follow("anilist:2", "y")]),
    );
    const report = await runCheck(t.deps);
    expect(report.notifications).toEqual({
      sent: 1,
      failed: 1,
      removedDevices: 0,
    });
    // Saved before sending: the failed one isn't repeated.
    expect(t.store.state["anilist:1"].episode).toBe(1);
  });
});
