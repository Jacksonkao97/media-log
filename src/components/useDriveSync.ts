"use client";

/* Runs SyncEngine against Google Drive for the signed-in account:
 *   - once when the page loads (after the local library is ready),
 *   - shortly after every local edit (debounced, only the touched regions),
 *   - when the tab comes back into view, every 5 minutes while visible, and
 *     when the browser comes back online.
 * Exposes a status for the UI and sign-in/out actions.
 *
 * Started offline (the installed app opened with no signal), the session
 * can't be fetched. The last signed-in account is remembered so the UI shows
 * it as offline rather than signed out, and connects once back online. */

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import { withTabLock } from "@/lib/tabs";
import type { Library, Region, RegionFile } from "@/lib/schema";
import {
  fetchSession,
  forgetToken,
  getAccessToken,
  idbSyncStore,
} from "@/lib/sync/client";
import { SyncEngine, type SyncReport } from "@/lib/sync/engine";
import {
  AuthError,
  googleDrive,
  type GoogleDrive,
} from "@/lib/sync/google-drive";

export type SyncStatus =
  | "disabled" // sign-in isn't configured on this server
  | "checking" // finding out whether we're signed in
  | "signed-out"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "reauth"; // signed in, but Google needs a fresh sign-in

export interface Account {
  name: string | null;
  email: string;
  image: string | null;
}

export interface DriveSync {
  status: SyncStatus;
  account: Account | null;
  lastSynced: number | null;
  error: string | null;
  folderUrl: string | null;
  /** Call after a local edit with the regions it touched. */
  schedule: (regions: Region[]) => void;
  syncNow: () => void;
  signIn: () => void;
  signOut: () => void;
}

const DEBOUNCE_MS = 1500;
const POLL_MS = 5 * 60_000;
const REFOCUS_MS = 60_000;

/** Who was signed in last: name, email and avatar only, never a token. */
const ACCOUNT_KEY = "medialog:account";

const lastAccount = {
  get(): Account | null {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null");
    } catch {
      return null;
    }
  },
  set(account: Account | null) {
    try {
      if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      // Storage blocked: an offline start just shows "signed out".
    }
  },
};

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface Options {
  enabled: boolean;
  /** The local library has loaded. */
  ready: boolean;
  /** Both must be stable (they read and write through a ref). */
  getLocal: () => Library;
  setLocal: (region: Region, file: RegionFile) => void;
}

export function useDriveSync({
  enabled,
  ready,
  getLocal,
  setLocal,
}: Options): DriveSync {
  const [status, setStatus] = useState<SyncStatus>(
    enabled ? "checking" : "disabled",
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  /** Bumped to look up the session again after an offline start. */
  const [connectAttempt, setConnectAttempt] = useState(0);
  /** Showing the remembered account because the session couldn't be fetched. */
  const unconnected = useRef(false);

  const engine = useRef<SyncEngine | null>(null);
  const drive = useRef<GoogleDrive | null>(null);
  const pending = useRef(new Set<Region>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastAttempt = useRef(0);
  /** Syncs started and not yet finished (they queue inside the engine). */
  const inflight = useRef(0);

  const run = useCallback(async (regions?: Region[], announce = false) => {
    const e = engine.current;
    if (!e) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    lastAttempt.current = Date.now();
    setStatus("syncing");
    inflight.current++;
    try {
      // One tab at a time: open tabs share one sync base in IndexedDB.
      const report: SyncReport = await withTabLock(`medialog-sync`, () =>
        e.sync(regions),
      );
      // An edit queued meanwhile, or a sync still waiting its turn, is not on
      // Drive yet: don't claim "synced" until everything has gone through.
      const busy = --inflight.current > 0 || pending.current.size > 0;
      setStatus(busy ? "syncing" : "synced");
      setError(null);
      setLastSynced(Date.now());
      setFolderUrl(drive.current?.folderUrl() ?? null);
      const { added, updated, removed } = report.pulled;
      const parts = [
        added && `新增 ${added}`,
        updated && `更新 ${updated}`,
        removed && `删除 ${removed}`,
      ].filter(Boolean);
      if (parts.length)
        toast.success(`已从 Google Drive 同步：${parts.join(" · ")}`);
      else if (announce)
        toast.success(
          report.pushed.length ? "已上传到 Google Drive" : "已是最新",
        );
    } catch (err) {
      inflight.current--;
      console.error(err);
      if (err instanceof AuthError) {
        setStatus("reauth");
        setError(err.message);
      } else if (!navigator.onLine) {
        setStatus("offline");
      } else {
        const message =
          err instanceof TypeError
            ? "网络错误，稍后会自动重试"
            : (err as Error).message;
        setStatus("error");
        setError(message);
        if (announce) toast.error(`同步失败：${message}`);
      }
    }
  }, []);

  /* Sign-in state, then the first sync. */
  useEffect(() => {
    if (!enabled || !ready) return;
    let cancelled = false;
    lastAttempt.current = Date.now();
    // Offline the request can only fail (the service worker never caches it).
    (navigator.onLine
      ? fetchSession()
      : Promise.reject(new TypeError("offline"))
    )
      .then((session) => {
        if (cancelled) return;
        unconnected.current = false;
        const email = session?.user?.email;
        if (!session || !email) {
          lastAccount.set(null);
          setAccount(null);
          setStatus("signed-out");
          return;
        }
        const current = {
          name: session.user?.name ?? null,
          email,
          image: session.user?.image ?? null,
        };
        setAccount(current);
        lastAccount.set(current);
        drive.current = googleDrive(getAccessToken);
        engine.current = new SyncEngine({
          remote: drive.current,
          store: idbSyncStore(email),
          getLocal,
          setLocal,
          today,
        });
        if (session.error) {
          setStatus("reauth");
          setError(
            session.error === "DriveScopeMissing"
              ? "登录时没有允许访问 Google Drive，请重新登录并勾选 Drive 权限"
              : "Google 登录已失效，请重新登录",
          );
          return;
        }
        void run();
      })
      .catch((err) => {
        if (cancelled) return;
        // No network (or not really back yet): show who was signed in, as
        // offline, and try again later. Edits stay local until then.
        const last = err instanceof TypeError ? lastAccount.get() : null;
        if (last) {
          unconnected.current = true;
          setAccount(last);
          setStatus("offline");
          return;
        }
        if (err instanceof TypeError) {
          setStatus("signed-out");
          return;
        }
        console.error(err);
        setStatus("error");
        setError("无法获取登录状态：服务器的登录配置可能有误（见服务器日志）");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, ready, getLocal, setLocal, run, connectAttempt]);

  /* Keep other devices' changes coming in. */
  useEffect(() => {
    if (!enabled) return;
    // Started offline there is no engine yet: look up the session first.
    const go = () =>
      unconnected.current ? setConnectAttempt((n) => n + 1) : void run();
    const maybe = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastAttempt.current > REFOCUS_MS
      )
        go();
    };
    const online = () =>
      engine.current ? void run() : setConnectAttempt((n) => n + 1);
    const offline = () => engine.current && setStatus("offline");
    const poll = setInterval(
      () => document.visibilityState === "visible" && go(),
      POLL_MS,
    );
    document.addEventListener("visibilitychange", maybe);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", maybe);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [enabled, run]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = useCallback(
    (regions: Region[]) => {
      if (!engine.current) return;
      regions.forEach((r) => pending.current.add(r));
      // Show that this edit is on its way, not "synced", during the debounce.
      setStatus((s) => (s === "reauth" || s === "offline" ? s : "syncing"));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const batch = [...pending.current];
        pending.current.clear();
        void run(batch);
      }, DEBOUNCE_MS);
    },
    [run],
  );

  return {
    status,
    account,
    lastSynced,
    error,
    folderUrl,
    schedule,
    syncNow: useCallback(
      () =>
        unconnected.current
          ? setConnectAttempt((n) => n + 1)
          : void run(undefined, true),
      [run],
    ),
    signIn: useCallback(() => void signIn("google"), []),
    signOut: useCallback(async () => {
      try {
        await signOut({ redirect: false });
      } catch (err) {
        console.error(err);
        toast.error("退出登录失败，请联网后再试");
        return;
      }
      lastAccount.set(null);
      unconnected.current = false;
      forgetToken();
      engine.current = null;
      drive.current = null;
      setAccount(null);
      setLastSynced(null);
      setError(null);
      setStatus("signed-out");
      toast.success("已退出登录。数据仍保存在这个浏览器里");
    }, []),
  };
}
