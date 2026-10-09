"use client";

/* Installable-app support:
 *   - PwaProvider registers the service worker (production only) and offers a
 *     reload when a new version has taken over.
 *   - useInstall says whether we can offer installing: Chromium fires
 *     `beforeinstallprompt`; iOS has no API, so we show how to do it by hand.
 *     Nothing is offered once the app is already running installed. */

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";
import { Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      // In dev the worker would cache stale builds; Serwist's dev caching is network-only anyway.
      disable={process.env.NODE_ENV !== "production"}
      // Sync already handles coming back online; a reload would lose an open edit.
      reloadOnOnline={false}
      // "/" is precached, so there is nothing more to cache on navigation.
      cacheOnNavigation={false}
    >
      <UpdateNotice />
      {children}
    </SerwistProvider>
  );
}

function UpdateNotice() {
  const { serwist } = useSerwist();
  useEffect(() => {
    if (!serwist) return;
    const onControlling = (event: { isUpdate?: boolean }) => {
      if (!event.isUpdate) return;
      toast("MediaLog 有新版本", {
        duration: Infinity,
        action: { label: "刷新", onClick: () => location.reload() },
      });
    };
    serwist.addEventListener("controlling", onControlling);
    return () => serwist.removeEventListener("controlling", onControlling);
  }, [serwist]);
  return null;
}

/* ---------------------------------------------------------------- install */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chromium can fire beforeinstallprompt before React mounts, so it is caught
// at module load and kept here.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we offer it from the menu instead of the mini-infobar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
    toast.success("已安装 MediaLog");
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", l);
  return () => {
    listeners.delete(l);
    mql.removeEventListener("change", l);
  };
};

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac, but with a touch screen.
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

export interface Install {
  /** "prompt": the browser's install dialog is available. "ios": show the
   *  Share → 添加到主屏幕 steps. null: nothing to offer. */
  mode: "prompt" | "ios" | null;
  install: () => void;
  /** The iOS how-to dialog. */
  iosOpen: boolean;
  setIosOpen: (open: boolean) => void;
}

export function useInstall(): Install {
  const mode = useSyncExternalStore(
    subscribe,
    () =>
      isStandalone() ? null : deferred ? "prompt" : isIos() ? "ios" : null,
    () => null,
  );
  const [iosOpen, setIosOpen] = useState(false);

  const install = async () => {
    if (mode === "ios") return setIosOpen(true);
    if (!deferred) return;
    const event = deferred;
    await event.prompt();
    await event.userChoice;
    deferred = null; // a prompt can only be used once
    notify();
  };

  return { mode, install: () => void install(), iosOpen, setIosOpen };
}

/** iOS has no install API: walk the user through Safari's Share menu. */
export function IosInstallDialog({ install }: { install: Install }) {
  const { iosOpen, setIosOpen } = install;
  return (
    <Dialog open={iosOpen} onOpenChange={setIosOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>安装到主屏幕</DialogTitle>
          <DialogDescription>
            装好后像 App 一样从主屏幕打开，全屏显示，离线也能用。
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="bg-muted inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Share aria-hidden className="size-[18px]" />
            </span>
            <span>
              1. 点浏览器工具栏里的 <b>分享</b> 按钮
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="bg-muted inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
              <SquarePlus aria-hidden className="size-[18px]" />
            </span>
            <span>
              2. 往下找到 <b>添加到主屏幕</b>，再点 <b>添加</b>
            </span>
          </li>
        </ol>
        <DialogFooter>
          <Button onClick={() => setIosOpen(false)} className="max-md:h-11">
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
