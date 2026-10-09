"use client";

/* 更新提醒 in the browser: notification permission, this device's push
 * subscription, and keeping the server's list of what it follows in step
 * with the library (lib/track/targets.ts decides what counts).
 *
 * The server only learns what the library follows from here, so the list is
 * re-sent a few seconds after it changes, and at least daily in case the
 * server lost it. Push needs the service worker, so none of this works under
 * `next dev`, and iOS only offers it to home-screen apps (16.4+). */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  followsOf,
  isAnime,
  type Follow,
  type TrackStatus,
} from "@/lib/track/targets";
import type { Library } from "@/lib/schema";
import { isIos, isStandalone } from "./Pwa";

export type ReminderState =
  | "loading"
  /** The server has no VAPID keys or store. */
  | "unconfigured"
  /** No Push API, or no service worker (dev mode). */
  | "unsupported"
  /** iPhone / iPad outside the home-screen app. */
  | "install"
  /** Notifications denied for this site. */
  | "blocked"
  | "off"
  | "on";

export interface Reminders {
  state: ReminderState;
  busy: boolean;
  /** What the library follows now. */
  follows: { all: Follow[]; anime: number; manga: number };
  /** What the server last said about this device (when on). */
  status: TrackStatus | null;
  enable: () => void;
  disable: () => void;
  test: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SYNCED = "medialog:reminders";
const DAY = 24 * 60 * 60 * 1000;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(action: string, payload: unknown): Promise<T> {
  const res = await fetch(`/api/track/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(json.error ?? `服务器出错（${res.status}）`, res.status);
  return json as T;
}

/** base64url VAPID key → the bytes PushManager.subscribe wants. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** A cheap fingerprint of the follow list, to skip re-sending an unchanged one. */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

function readSynced(): { fp: string; at: number } | null {
  try {
    return JSON.parse(localStorage.getItem(SYNCED) ?? "null");
  } catch {
    return null;
  }
}
function writeSynced(fp: string | null) {
  try {
    if (fp)
      localStorage.setItem(SYNCED, JSON.stringify({ fp, at: Date.now() }));
    else localStorage.removeItem(SYNCED);
  } catch {
    // Private mode: it just re-sends next time.
  }
}

/** What this browser can do, which doesn't change while the page is open. */
type Capability = "pending" | "none" | "install" | "push";
const never = () => () => {};
function capability(): Capability {
  if (isIos() && !isStandalone()) return "install";
  return "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
    ? "push"
    : "none";
}

/** The service worker's registration, or null if none shows up (dev mode). */
function registration(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
  ]);
}

export function useReminders(
  publicKey: string | null,
  library: Library | null,
): Reminders {
  const can = useSyncExternalStore(never, capability, () => "pending" as const);
  const [sub, setSub] = useState<"loading" | "none" | "blocked" | "off" | "on">(
    "loading",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<TrackStatus | null>(null);
  const [open, setOpen] = useState(false);

  const all = useMemo(() => (library ? followsOf(library) : []), [library]);
  const follows = useMemo(() => {
    const anime = all.filter((f) => isAnime(f.target)).length;
    return { all, anime, manga: all.length - anime };
  }, [all]);
  const json = useMemo(() => JSON.stringify(all), [all]);
  const loaded = library !== null;

  // Is this device subscribed already?
  useEffect(() => {
    if (can !== "push" || !publicKey) return;
    let live = true;
    registration().then(async (reg) => {
      const current = reg ? await reg.pushManager.getSubscription() : null;
      if (!live) return;
      if (!reg) setSub("none");
      else if (Notification.permission === "denied") setSub("blocked");
      else setSub(current ? "on" : "off");
    });
    return () => {
      live = false;
    };
  }, [can, publicKey]);

  const state: ReminderState = !publicKey
    ? "unconfigured"
    : can === "pending"
      ? "loading"
      : can === "none" || sub === "none"
        ? "unsupported"
        : can === "install"
          ? "install"
          : sub;

  async function current(): Promise<PushSubscription | null> {
    const reg = await registration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  /** Tells the server what this device follows. */
  async function register(s: PushSubscription) {
    const result = await api<TrackStatus>("subscribe", {
      subscription: s.toJSON(),
      follows: all,
    });
    writeSynced(fingerprint(json));
    setStatus(result);
    return result;
  }

  // Keep the server's list in step with the library.
  useEffect(() => {
    if (state !== "on" || !loaded) return;
    const synced = readSynced();
    const fp = fingerprint(json);
    if (synced?.fp === fp && Date.now() - synced.at < DAY) return;
    const t = setTimeout(async () => {
      try {
        const s = await current();
        if (!s) return setSub("off");
        await register(s);
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearTimeout(t);
    // register/current read the latest render's values; json covers `all`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, json, loaded]);

  // Opening the dialog asks the server how things stand.
  useEffect(() => {
    if (!open || state !== "on") return;
    let live = true;
    (async () => {
      const s = await current();
      if (!s) return live && setSub("off");
      try {
        const result = await api<TrackStatus>("status", {
          endpoint: s.endpoint,
        });
        if (live) setStatus(result);
      } catch (err) {
        // The server forgot this device (a reset store): tell it again.
        if (err instanceof ApiError && err.status === 404 && live)
          await register(s).catch(() => {});
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    let created: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setSub("blocked");
        toast.error("没有得到通知权限，无法开启提醒");
        return;
      }
      const reg = await registration();
      if (!reg) return setSub("none");
      created =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const result = await register(created);
      setSub("on");
      toast.success(`已开启更新提醒：${result.following} 部作品`);
    } catch (err) {
      // Don't leave a subscription the server doesn't know about.
      await created?.unsubscribe().catch(() => {});
      toast.error(`开启失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const s = await current();
      if (s) {
        await api("unsubscribe", { endpoint: s.endpoint }).catch(() => {});
        await s.unsubscribe();
      }
      writeSynced(null);
      setStatus(null);
      setSub("off");
      toast.success("已关闭更新提醒");
    } catch (err) {
      toast.error(`关闭失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const s = await current();
      if (!s) return setSub("off");
      try {
        await api("test", { endpoint: s.endpoint });
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
        await register(s);
        await api("test", { endpoint: s.endpoint });
      }
      toast.success("已发送测试通知，几秒内应该会收到");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    state,
    busy,
    follows,
    status,
    enable: () => void enable(),
    disable: () => void disable(),
    test: () => void test(),
    open,
    setOpen,
  };
}
