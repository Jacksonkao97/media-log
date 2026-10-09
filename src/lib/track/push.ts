/* Web Push: notifications to devices that turned 更新提醒 on, signed with
 * this server's VAPID key (see config.ts). */

import { createHash } from "node:crypto";
import webpush from "web-push";
import type { PushConfig } from "./config";
import type { PushSub } from "./store";

/** What the service worker shows (src/sw/sw.ts). */
export interface PushMessage {
  title: string;
  body: string;
  /** Opened on tap: a page, or "/" for the app. */
  url: string;
  /** A newer notification with the same tag replaces the older one. */
  tag: string;
}

/* The browsers' push services. The server POSTs to whatever endpoint a
 * browser registers, so only these hosts are accepted; anything else could
 * make it send requests to arbitrary addresses. */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge on Android, Samsung, Opera
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari, iOS home-screen apps
  "notify.windows.com", // Edge on Windows
];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const host = url.hostname;
  return (
    url.protocol === "https:" &&
    PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  );
}

const B64URL = /^[A-Za-z0-9_-]+=*$/;

/** A browser's PushSubscription JSON, if it is one we will send to. */
export function cleanSub(raw: unknown): PushSub | null {
  const s = (raw ?? {}) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const { endpoint } = s;
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 1000 ||
    !isPushEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    p256dh.length > 200 ||
    auth.length > 100 ||
    !B64URL.test(p256dh) ||
    !B64URL.test(auth)
  )
    return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** A stable id for a subscription, without storing the endpoint as a key. */
export const subscriberId = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("base64url").slice(0, 22);

/** "gone": the subscription has expired or been revoked; forget it. */
export async function sendPush(
  cfg: PushConfig,
  sub: PushSub,
  msg: PushMessage,
): Promise<"sent" | "gone"> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(msg), {
      vapidDetails: cfg,
      // Undelivered after 12 h (phone off), it's old news.
      TTL: 12 * 60 * 60,
    });
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    throw new Error(
      `推送失败${status ? `（${status}）` : ""}：${(err as Error).message}`,
    );
  }
}
