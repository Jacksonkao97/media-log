/* 更新提醒 API.
 *
 *   POST /api/track/subscribe    { subscription, follows }  turn on, or update what a device follows
 *   POST /api/track/status       { endpoint }               what the server knows about a device
 *   POST /api/track/unsubscribe  { endpoint }
 *   POST /api/track/test         { endpoint }               send that device a test notification
 *   GET or POST /api/track/check                            one round of checks (lib/track/engine.ts),
 *        with `Authorization: Bearer $CRON_SECRET`          for a scheduler
 *
 * A device is known only by its push subscription; there is no sign-in. */

import { timingSafeEqual, createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  cronSecret,
  mangaEveryMs,
  pushConfig,
  type PushConfig,
} from "@/lib/track/config";
import { runCheck } from "@/lib/track/engine";
import { fetchAired } from "@/lib/track/episodes";
import { fetchComic } from "@/lib/track/manhuagui";
import { cleanSub, sendPush, subscriberId } from "@/lib/track/push";
import { getStore, type TrackStore } from "@/lib/track/store";
import {
  cleanFollows,
  isAnime,
  type Follow,
  type TrackStatus,
} from "@/lib/track/targets";

// A round checks manga for up to 40 s (engine.ts); serverless hosts need
// to be told a function may run that long.
export const maxDuration = 60;

/** Devices allowed at once: plenty for one person, a ceiling for a public URL. */
const MAX_DEVICES = 200;

const fail = (status: number, error: string) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
const ok = (body: unknown) =>
  Response.json(body, { headers: { "Cache-Control": "no-store" } });

/** The JSON body, or null if missing, malformed or over 256 KB. */
async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > 256 * 1024) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const same = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );

async function status(
  store: TrackStore,
  follows: Follow[],
): Promise<TrackStatus> {
  const [states, lastRun] = await Promise.all([
    store.states(),
    store.lastRun(),
  ]);
  const anime = follows.filter((f) => isAnime(f.target)).length;
  return {
    following: follows.length,
    anime,
    manga: follows.length - anime,
    lastRun,
    mangaHours: mangaEveryMs() / 3_600_000,
    failing: follows
      .filter((f) => states[f.target]?.error)
      .map((f) => ({ name: f.name, error: states[f.target].error! })),
  };
}

async function handle(
  req: NextRequest,
  action: string,
  cfg: PushConfig,
  store: TrackStore,
): Promise<Response> {
  if (action === "check") {
    const secret = cronSecret();
    if (!secret) return fail(503, "服务器还没有设置 CRON_SECRET");
    const auth = req.headers.get("authorization") ?? "";
    if (!same(auth, `Bearer ${secret}`)) return fail(401, "CRON_SECRET 不对");
    return ok(
      await runCheck({
        store,
        aired: fetchAired,
        comic: fetchComic,
        send: (sub, msg) => sendPush(cfg, sub, msg),
        mangaEveryMs: mangaEveryMs(),
      }),
    );
  }
  if (req.method !== "POST") return fail(405, "只接受 POST");

  const input = await body(req);
  if (!input) return fail(400, "请求格式不对");

  if (action === "subscribe") {
    const sub = cleanSub(input.subscription);
    if (!sub) return fail(400, "这个推送订阅无效");
    const id = subscriberId(sub.endpoint);
    if (
      !(await store.subscriber(id)) &&
      (await store.countSubscribers()) >= MAX_DEVICES
    )
      return fail(503, "开启提醒的设备已经太多了");
    const follows = cleanFollows(input.follows);
    await store.saveSubscriber({ id, sub, follows, updatedAt: Date.now() });
    return ok(await status(store, follows));
  }

  const endpoint = typeof input.endpoint === "string" ? input.endpoint : "";
  if (!endpoint) return fail(400, "缺少 endpoint");
  const id = subscriberId(endpoint);

  if (action === "unsubscribe") {
    await store.removeSubscriber(id);
    return ok({});
  }
  const device = await store.subscriber(id);
  if (!device) return fail(404, "服务器上没有这台设备，请重新开启提醒");
  if (action === "status") return ok(await status(store, device.follows));
  if (action === "test") {
    const result = await sendPush(cfg, device.sub, {
      title: "MediaLog 更新提醒",
      body: `提醒已开启：${device.follows.length} 部「看着」的作品有更新时会通知你`,
      url: "/",
      tag: "medialog-test",
    });
    if (result === "gone") {
      await store.removeSubscriber(id);
      return fail(410, "这台设备的推送订阅已失效，请重新开启提醒");
    }
    return ok({});
  }
  return fail(404, "没有这个操作");
}

async function route(
  req: NextRequest,
  ctx: RouteContext<"/api/track/[action]">,
) {
  const { action } = await ctx.params;
  const cfg = pushConfig();
  const store = getStore();
  if (!cfg || !store)
    return fail(503, "服务器还没有配置更新提醒（见 README「更新提醒」）");
  try {
    return await handle(req, action, cfg, store);
  } catch (err) {
    console.error(err);
    return fail(500, (err as Error).message || "服务器出错了");
  }
}

export { route as GET, route as POST };
