/* Where the tracker keeps its state: the devices that turned 更新提醒 on
 * (push subscription + what they follow) and, per target, what was last
 * seen. Nothing else from the library is stored.
 *
 *   - Upstash Redis, over its REST API (UPSTASH_REDIS_REST_URL / _TOKEN, or
 *     the KV_REST_API_* names Vercel's integration sets). Works from any host.
 *   - Otherwise a JSON file (TRACK_FILE, default .data/track.json): for a
 *     server with a disk, and for local development. Serverless hosts have no
 *     lasting disk, so there the file store is refused and Upstash required. */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Follow } from "./targets";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Subscriber {
  /** Derived from the endpoint (subscriberId). */
  id: string;
  sub: PushSub;
  follows: Follow[];
  /** Unix ms. */
  updatedAt: number;
}

export interface TargetState {
  /** Unix ms of the last check (manga) or update (anime). */
  checkedAt: number;
  /** manhuagui: the newest chapter seen. */
  latestId?: number;
  latest?: string;
  /** AniList: the newest episode notified. */
  episode?: number;
  /** The last check failed with this. */
  error?: string;
}

export interface TrackStore {
  subscribers(): Promise<Subscriber[]>;
  subscriber(id: string): Promise<Subscriber | null>;
  saveSubscriber(s: Subscriber): Promise<void>;
  removeSubscriber(id: string): Promise<void>;
  countSubscribers(): Promise<number>;
  states(): Promise<Record<string, TargetState>>;
  /** Writes `changed` and forgets `drop` (targets nobody follows any more). */
  saveStates(
    changed: Record<string, TargetState>,
    drop: string[],
  ): Promise<void>;
  /** When anime were last checked (unix ms), so the next check starts there. */
  lastRun(): Promise<number | null>;
  setLastRun(ms: number): Promise<void>;
}

const parse = <T>(s: unknown): T | null => {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------- Upstash */

const SUBS = "medialog:subs";
const STATE = "medialog:state";
const LAST_RUN = "medialog:lastrun";

export class UpstashStore implements TrackStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  /** Runs commands in one round trip (the REST API's /pipeline). */
  private async run(...cmds: (string | number)[][]): Promise<unknown[]> {
    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmds),
        cache: "no-store",
      });
    } catch (err) {
      throw new Error(`连不上 Upstash：${(err as Error).message}`);
    }
    if (!res.ok) throw new Error(`Upstash 出错（${res.status}）`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Upstash 出错：${failed.error}`);
    return out.map((r) => r.result);
  }

  async subscribers() {
    const [vals] = await this.run(["HVALS", SUBS]);
    return ((vals as string[]) ?? [])
      .map((v) => parse<Subscriber>(v))
      .filter((s): s is Subscriber => s !== null);
  }
  async subscriber(id: string) {
    const [v] = await this.run(["HGET", SUBS, id]);
    return parse<Subscriber>(v);
  }
  async saveSubscriber(s: Subscriber) {
    await this.run(["HSET", SUBS, s.id, JSON.stringify(s)]);
  }
  async removeSubscriber(id: string) {
    await this.run(["HDEL", SUBS, id]);
  }
  async countSubscribers() {
    const [n] = await this.run(["HLEN", SUBS]);
    return Number(n) || 0;
  }
  async states() {
    const [flat] = await this.run(["HGETALL", STATE]);
    const list = (flat as string[]) ?? [];
    const out: Record<string, TargetState> = {};
    for (let i = 0; i + 1 < list.length; i += 2) {
      const s = parse<TargetState>(list[i + 1]);
      if (s) out[list[i]] = s;
    }
    return out;
  }
  async saveStates(changed: Record<string, TargetState>, drop: string[]) {
    const cmds: (string | number)[][] = [];
    const pairs = Object.entries(changed).flatMap(([k, v]) => [
      k,
      JSON.stringify(v),
    ]);
    if (pairs.length) cmds.push(["HSET", STATE, ...pairs]);
    if (drop.length) cmds.push(["HDEL", STATE, ...drop]);
    if (cmds.length) await this.run(...cmds);
  }
  async lastRun() {
    const [v] = await this.run(["GET", LAST_RUN]);
    return v === null || v === undefined ? null : Number(v);
  }
  async setLastRun(ms: number) {
    await this.run(["SET", LAST_RUN, ms]);
  }
}

/* ---------------------------------------------------------------- file */

interface FileData {
  subscribers: Record<string, Subscriber>;
  states: Record<string, TargetState>;
  lastRun: number | null;
}

export class FileStore implements TrackStore {
  // Requests in one process take turns, so two writes can't lose each other.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string) {}

  private async read(): Promise<FileData> {
    const text = await readFile(this.file, "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return null;
        throw err;
      },
    );
    const data = text ? parse<Partial<FileData>>(text) : null;
    if (text && !data) throw new Error(`${this.file} 不是有效的 JSON`);
    return {
      subscribers: data?.subscribers ?? {},
      states: data?.states ?? {},
      lastRun: data?.lastRun ?? null,
    };
  }

  /** Read, change, write back atomically (write a temp file, then rename). */
  private update<T>(fn: (d: FileData) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.read();
      const out = fn(data);
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 1));
      await rename(tmp, this.file);
      return out;
    });
    this.queue = next.catch(() => {});
    return next;
  }

  private view<T>(fn: (d: FileData) => T): Promise<T> {
    const next = this.queue.then(async () => fn(await this.read()));
    this.queue = next.catch(() => {});
    return next;
  }

  subscribers() {
    return this.view((d) => Object.values(d.subscribers));
  }
  subscriber(id: string) {
    return this.view((d) => d.subscribers[id] ?? null);
  }
  saveSubscriber(s: Subscriber) {
    return this.update((d) => {
      d.subscribers[s.id] = s;
    });
  }
  removeSubscriber(id: string) {
    return this.update((d) => {
      delete d.subscribers[id];
    });
  }
  countSubscribers() {
    return this.view((d) => Object.keys(d.subscribers).length);
  }
  states() {
    return this.view((d) => d.states);
  }
  saveStates(changed: Record<string, TargetState>, drop: string[]) {
    return this.update((d) => {
      Object.assign(d.states, changed);
      for (const t of drop) delete d.states[t];
    });
  }
  lastRun() {
    return this.view((d) => d.lastRun);
  }
  setLastRun(ms: number) {
    return this.update((d) => {
      d.lastRun = ms;
    });
  }
}

/* -------------------------------------------------------------- choose */

/** Hosts whose disk doesn't outlive a request. */
const ephemeral = () =>
  Boolean(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

export type StoreKind = "upstash" | "file" | null;

export function storeKind(): StoreKind {
  const env = process.env;
  if (
    (env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) &&
    (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN)
  )
    return "upstash";
  return ephemeral() ? null : "file";
}

/** The configured store, or null when there is none (serverless host
 *  without Upstash). */
export function getStore(): TrackStore | null {
  const env = process.env;
  switch (storeKind()) {
    case "upstash":
      return new UpstashStore(
        (env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL)!,
        (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN)!,
      );
    case "file":
      return fileStore(env.TRACK_FILE?.trim() || ".data/track.json");
    default:
      return null;
  }
}

// One FileStore per file, so its queue covers every request in the process.
const files = new Map<string, FileStore>();
function fileStore(file: string) {
  const abs = path.resolve(file);
  let s = files.get(abs);
  if (!s) files.set(abs, (s = new FileStore(abs)));
  return s;
}
