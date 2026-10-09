/* 更新提醒 settings, from the environment:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  made once with `npx web-push generate-vapid-keys`
 *   VAPID_SUBJECT                        mailto: or https: contact for the push services
 *   CRON_SECRET                          what the scheduler sends as `Authorization: Bearer …`
 *   TRACK_MANGA_HOURS                    how often each manga is re-checked (default 6)
 * plus a store (store.ts). Kept apart from push.ts so the page can ask
 * without loading web-push. */

import { REMINDERS_ENABLED } from "./enabled";
import { storeKind } from "./store";

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject
    ? { publicKey, privateKey, subject }
    : null;
}

export const cronSecret = () => process.env.CRON_SECRET?.trim() || null;

export function mangaEveryMs(): number {
  const raw = process.env.TRACK_MANGA_HOURS?.trim();
  const hours = raw ? Number(raw) : NaN;
  return (Number.isFinite(hours) && hours >= 0 ? hours : 6) * 60 * 60 * 1000;
}

/** The VAPID public key the browser subscribes with, or null when the server
 *  can't send reminders (switched off, no keys, or no store). */
export function trackPublicKey(): string | null {
  if (!REMINDERS_ENABLED) return null;
  const cfg = pushConfig();
  return cfg && storeKind() ? cfg.publicKey : null;
}
