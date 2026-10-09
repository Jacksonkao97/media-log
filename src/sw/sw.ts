/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/* The service worker (Serwist), compiled by src/app/serwist/[path]/route.ts
 * and served at /serwist/sw.js. It makes the installed app open offline:
 *
 *   - precached: every build file plus "/" (the app shell, re-fetched each
 *     deploy). Any "/?…" — the 新增 shortcut, Android share links — is served
 *     from that same shell, so it works offline too.
 *   - never cached: Google (sign-in, Drive API, avatars). Drive replies hold
 *     the user's data, and a stale one would mislead sync; when offline those
 *     requests should simply fail, which sync already handles.
 *   - everything else: Serwist's defaults for Next.js (/api/auth is network-only). */

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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    ignoreURLParametersMatching: [/.*/],
    cleanupOutdatedCaches: true,
  },
  // A new version takes over at once; the page offers a reload (see PwaProvider).
  skipWaiting: true,
  clientsClaim: true,
  // "/" comes from the precache, so a navigation preload would be wasted.
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => GOOGLE.test(url.hostname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
