/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/* The service worker (Serwist), compiled by src/app/serwist/[path]/route.ts
 * and served at /serwist/sw.js. It makes the installed app open offline:
 *
 *   - precached: every build file plus each view's page ("/", "/cn",
 *     "/discover/season", …; lib/view.ts), re-fetched each deploy. Any
 *     "/?…" — the 新增 shortcut, Android share links — is served from "/",
 *     so it works offline too.
 *   - never cached: Google (sign-in, Drive API, avatars). Drive replies hold
 *     the user's data, and a stale one would mislead sync; when offline those
 *     requests should simply fail, which sync already handles.
 *   - not cached here either: AniList / TMDB posters (发现). They are opaque
 *     cross-origin responses, which Chrome counts as ~7 MB of quota each; the
 *     browser's own HTTP cache keeps them instead.
 *   - everything else: Serwist's defaults for Next.js. /api/auth is
 *     network-only; other /api/ GETs, such as the 发现 feeds, are network-first,
 *     so the last copy still shows offline.
 *
 * It also shows 更新提醒 notifications pushed by the server
 * (lib/track/push.ts), and opens the right page when one is tapped. */

import { defaultCache } from "@serwist/turbopack/worker";
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const GOOGLE = /(^|\.)(google\.com|googleapis\.com|googleusercontent\.com)$/;
const POSTERS = /(^|\.)(anilist\.co|tmdb\.org)$/;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    ignoreURLParametersMatching: [/.*/],
    cleanupOutdatedCaches: true,
  },
  // A new version takes over at once; the page offers a reload (see PwaProvider).
  skipWaiting: true,
  clientsClaim: true,
  // Pages come from the precache, so a navigation preload would be wasted.
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        GOOGLE.test(url.hostname) || POSTERS.test(url.hostname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

/* ------------------------------------------------------------ 更新提醒 */

/** lib/track/push.ts PushMessage. */
interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

self.addEventListener("push", (event) => {
  let msg: PushMessage;
  try {
    msg = event.data?.json() as PushMessage;
  } catch {
    msg = {
      title: "MediaLog",
      body: event.data?.text() ?? "",
      url: "/",
      tag: "",
    };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "MediaLog", {
      body: msg.body,
      tag: msg.tag || undefined,
      // An update replacing an older one for the same work should still alert.
      renotify: Boolean(msg.tag),
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: msg.url || "/" },
      lang: "zh-Hans",
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? "/",
    self.location.origin,
  );
  event.waitUntil(
    (async () => {
      // The app: bring an open window forward rather than opening another.
      if (url.origin === self.location.origin) {
        const open = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (open[0]) return void (await open[0].focus());
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
