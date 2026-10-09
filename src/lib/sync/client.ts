/* Browser glue for sync: the access token (from the Auth.js session) and the
 * per-account sync state in IndexedDB. */

import { getCsrfToken, getSession } from "next-auth/react";
import type { Session } from "next-auth";
import { kvGet, kvSet } from "../storage";
import type { SyncStore } from "./engine";
import { AuthError } from "./google-drive";

let cached: { token: string; until: number } | null = null;

export function forgetToken() {
  cached = null;
}

/** POSTing to the session endpoint runs the jwt callback with trigger
 *  "update"; `refresh: true` makes it refresh the Google token now. This is
 *  what next-auth's useSession().update() sends. */
async function refreshedSession(): Promise<Session | null> {
  const csrfToken = await getCsrfToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csrfToken, data: { refresh: true } }),
  });
  return res.ok ? res.json() : null;
}

/** A Google access token for Drive. `force` asks the server for a new one. */
export async function getAccessToken(force = false): Promise<string> {
  if (!force && cached && Date.now() < cached.until) return cached.token;
  const session = force ? await refreshedSession() : await getSession();
  if (!session?.accessToken || session.error) {
    cached = null;
    throw new AuthError(
      session?.error === "DriveScopeMissing"
        ? "登录时没有允许访问 Google Drive，请重新登录并勾选 Drive 权限"
        : "Google 登录已失效，请重新登录",
    );
  }
  cached = {
    token: session.accessToken,
    until: (session.expiresAt ?? 0) * 1000 - 60_000,
  };
  return cached.token;
}

/** Sync state lives under the account's email, so switching Google accounts
 *  never merges against another account's base. It is kept on sign-out:
 *  signing back in still knows what was deleted elsewhere meanwhile. */
export function idbSyncStore(account: string): SyncStore {
  const key = (part: string) => `sync:${account}:${part}`;
  return {
    get: (region) => kvGet(key(region)),
    set: (region, state) => kvSet(key(region), state),
    lastSnapshot: () => kvGet<string>(key("snapshot")),
    setLastSnapshot: (day) => kvSet(key("snapshot"), day),
  };
}
