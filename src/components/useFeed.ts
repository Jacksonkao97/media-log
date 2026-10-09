"use client";

/* Loads one 发现 feed from /api/discover. Results stay in memory for the
 * session, so switching feeds or tabs back and forth is instant; after ten
 * minutes the old copy still shows while a new one loads. Offline, the
 * service worker answers with the last copy it saw, if any. */

import { useEffect, useState } from "react";
import type { FeedData } from "@/lib/discover/types";

export type FeedState =
  | { status: "loading" }
  | { status: "ready"; data: FeedData }
  | { status: "error"; message: string };

const memory = new Map<string, { data: FeedData; at: number }>();
const FRESH_MS = 10 * 60_000;

async function load(url: string, signal: AbortSignal): Promise<FeedData> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error(
      navigator.onLine ? "连不上服务器，请稍后再试" : "没有网络，联网后再试",
    );
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `服务器出错（${res.status}）`);
  return body as FeedData;
}

export function useFeed(url: string): FeedState & { reload: () => void } {
  // Bumped by reload(); part of the key, so a retry is a new request.
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${url}`;
  const [result, setResult] = useState<{ key: string; state: FeedState }>();

  useEffect(() => {
    const kept = memory.get(url);
    if (kept && Date.now() - kept.at < FRESH_MS) return;
    const ctrl = new AbortController();
    load(url, ctrl.signal).then(
      (data) => {
        memory.set(url, { data, at: Date.now() });
        setResult({ key, state: { status: "ready", data } });
      },
      (err: Error) => {
        if (!ctrl.signal.aborted)
          setResult({ key, state: { status: "error", message: err.message } });
      },
    );
    return () => ctrl.abort();
  }, [url, key]);

  const kept = memory.get(url);
  let state: FeedState;
  if (result?.key === key && result.state.status !== "error") {
    state = result.state;
  } else if (kept) {
    // A failed refresh keeps showing what we had.
    state = { status: "ready", data: kept.data };
  } else {
    state = result?.key === key ? result.state : { status: "loading" };
  }
  return {
    ...state,
    reload: () => {
      memory.delete(url);
      setAttempt((n) => n + 1);
    },
  };
}
