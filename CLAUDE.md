# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

MediaLog is a personal anime / manga / movie tracker. This is v2, a Next.js rebuild, live at https://media-log-seven.vercel.app (Vercel deploys `main`); it was merged into `main` before the first deploy. The v1 version (plain `index.html` + `app.js`, with edits written to `data/*.json` through the File System Access API) lives in the history from before that merge.

UI text and the README are Simplified Chinese; code comments are English.

**Agreed plan, in order:**

1. Port the v1 UI to Next.js, storing data in the browser (done).
2. Google sign-in plus automatic Drive sync: the four region files, plus a daily dated snapshot, because Drive only keeps old versions for about 30 days (done).
3. Make it an installable PWA so it works on phones, including offline (done).
4. "Latest anime/movies" using AniList (anime/manga, including airing schedules) and TMDB (movies) (done).
5. Episode/site trackers with notifications, which need a server-side scheduled job (done: Web Push for AniList episodes and manhuagui chapters; any scheduler can call the check). The site is hosted on Vercel, whose free plan only runs cron once a day. 更新提醒 is switched off for now (see below).
6. Go public, keeping each user's data in their own Google Drive (in progress). The site is live and the repo is public (2026-10-10). The Google OAuth app deliberately stays in Testing for now, so only accounts listed as test users can sign in; anyone the owner demos to must be added there first. `TODO.md` tracks what's left and future ideas; keep it current.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build; also generates route types such as LayoutProps
npm run lint           # ESLint (next lint no longer exists in Next 16)
npm run format         # Prettier; data/ is excluded via .prettierignore
npx tsc --noEmit       # typecheck; needs a build or `next dev` first for the generated types
npx tsc --noEmit -p src/sw   # typecheck the service worker (its own tsconfig, webworker lib)
npm test               # Vitest: src/**/*.test.ts (sync merge and engine, launch params, view URLs, import, discover feeds, tracker)
npx vitest run src/lib/sync/merge.test.ts -t "newer edit"   # one file / one test
node scripts/generate-icons.mjs   # regenerate every app icon (sharp); edit this, not the PNGs
```

Vitest covers pure logic only. To check UI behaviour, drive the running app in a browser. Some Playwright pitfalls:

- Pass files to `setInputFiles` as `{ name, mimeType, buffer }`. Headless Chromium silently drops files whose path contains non-ASCII characters, such as `data/日本.json`.
- The editor is a Radix `role="dialog"`, not a native `<dialog>`.
- Single-choice toggle groups are `role="radiogroup"` with `radio` items. The multi-select chip groups are `role="toolbar"` with `aria-pressed` buttons.
- To test sync without real Google, build and start with placeholder env (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, plus `AUTH_TRUST_HOST=true` for `next start`). Then use `context.route` to answer `/api/auth/session` (a session with `accessToken`), `/api/auth/csrf` and `/api/auth/signout`, and serve `https://www.googleapis.com/**` from an in-memory Drive. Use one route handler per browser context, sharing one fake Drive to simulate several devices.
- A production build runs the service worker, and Drive calls then go through it. Playwright only routes, and applies `setOffline` to, service-worker requests when run with `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`. Without it the fake Drive is bypassed.
- To check installability, call CDP `Page.getInstallabilityErrors` through `context.newCDPSession(page)`. To test the install button, dispatch a synthetic `beforeinstallprompt` `Event` with `prompt` and `userChoice` attached. iOS needs an iPhone user agent; fake standalone mode by defining `Navigator.prototype.standalone` in an init script.
- To simulate offline for the service worker, stop the server rather than calling `setOffline`, which did not stop the worker's own requests even with the flag above.
- To test 更新提醒 end to end, build with throwaway VAPID keys (`npx web-push generate-vapid-keys`) and run `next start` with `CRON_SECRET`, a scratch `TRACK_FILE` and `TRACK_MANGA_HOURS=0`. Preload a module that answers manhuagui pages and the AniList `mediaId_in` query from a control file the test edits between rounds. Have it replace `https.request` for `fcm.googleapis.com`: web-push uses that, not `fetch`. Log each push's body, and decrypt it with `http_ece` (a web-push dependency) using a P-256 key pair you made for the fake device. Headless Chromium has no push service, so stub `PushManager.prototype.subscribe`/`getSubscription` in an init script, returning that fake device. Launch with `channel: "chromium"`: the default headless shell reports `Notification.permission` as `"denied"` even when granted. CDP `ServiceWorker.deliverPushMessage` exercises the worker's `push` handler; read the result back with `registration.getNotifications()`.
- To test 发现 without AniList/TMDB (or without network to them), start the server with `NODE_OPTIONS="--import ./fake-upstream.mjs"`: a module that replaces `globalThis.fetch` and answers `https://graphql.anilist.co` and `https://api.themoviedb.org/` from fixtures. Next wraps whatever `fetch` it finds, so its fetch cache still runs and the whole route is exercised. Serve posters with `context.route` on `s4.anilist.co` and `image.tmdb.org`. Set any `TMDB_API_KEY` at build time, or the 电影 feed isn't offered at all (`shownFeeds`).

**Installing packages.** npm 10's resolver can crash with `Cannot read properties of null (reading 'edgesOut')` while resolving optional peer loops, as Vitest's do. If `npm install <pkg>` hits that, retry with `--legacy-peer-deps`. A plain `npm install`/`npm ci` from the lockfile works.

## Architecture

The app is one client-side component: `src/app/[[...view]]/page.tsx` renders `src/components/MediaLog.tsx` (`"use client"`), which holds all state. Google Analytics (`src/components/Analytics.tsx`, `src/lib/analytics.ts`) loads from `layout.tsx` only when `NEXT_PUBLIC_GA_ID` is set; see Security. The only server code is Google sign-in (`src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`), the 发现 feeds (`src/app/api/discover/[feed]/route.ts`) and 更新提醒 (`src/app/api/track/[action]/route.ts`).

`page.tsx` passes `initialView` (from the URL, below), `syncEnabled` (all three auth env vars set), `moviesEnabled` (`TMDB_API_KEY` set) and `pushKey` (the VAPID public key, when reminders are configured). The pages are statically prerendered, so `next build` captures them; after changing the env, rebuild. `next dev` re-reads it.

`MediaLog` has two sections, `library` (the regions) and `discover` (发现); `section`, `region` and `feed` are its state. The desktop sidebar lists both; on phones a 片单 / 发现 switch in the top bar picks the section, and the second row shows its regions or feeds.

**Views and URLs** (`src/lib/view.ts`, `src/app/[[...view]]/page.tsx`).

- Every view has its own path. `/` is 日本; `/cn`, `/kr` and `/west` are the other regions; `/discover/<feed>` is a 发现 feed. `generateStaticParams` prerenders every view (`viewPaths()`: 8, or 7 without 电影) and `dynamicParams = false` makes every other path a 404. A reload therefore paints the right region or feed at once. Restoring a view on the client, from `localStorage` or a hash, can't do that: the first paint would be the prerendered default, then it would jump.
- `MediaLog` starts from `initialView`. When `section`, `region` or `feed` changes, an effect calls `history.pushState` with `viewPath()`. Next integrates native `pushState`, so nothing reloads and the library stays in memory. On `popstate` (Back/Forward) the state is read back with `parseView()`. A feed URL doesn't name a region, so the phone's 片单 switch returns to the region last shown, and vice versa.
- Each page's title names its view (`viewTitle()`, e.g. 韩国 · MediaLog), from `generateMetadata` when prerendered and from the same effect after a switch. Feed names live in `FEED_LABEL` (`lib/discover/feeds.ts`) so the server can read them; `Discover.tsx` is a client module.
- The service worker precaches the same pages (`viewPaths()`), so each one opens offline. The installed app's `start_url` and the 新增 shortcut stay on `/`.

The components under `src/components/`:

- `Chrome.tsx` holds the desktop `Sidebar` and the phone `MobileBar`. Both show the region and 发现 nav, the save/sync status, the account (from `Account.tsx`), import/export, 更新提醒 and the install entry (from `Pwa.tsx`).
  - At the bottom of the sidebar, 更新提醒 and 安装应用 sit above the account card. With 更新提醒 switched off (`REMINDERS_ENABLED`) and nothing to install, that block isn't rendered.
  - Import/export follow sign-in (`isSignedIn` in `Account.tsx`). Signed out, they are buttons under 登录 Google 同步. Signed in, they are entries in the account's ⋯ menu, right under 立即同步. The phone ⋯ menu follows the same rule.
  - While the session is still `checking`, the signed-out layout shows. It is about as tall as the signed-in card, so the sidebar doesn't jump.
- `useBackupReminder.ts` suggests 导出备份 to anyone not signed in, once 30 days have passed without an export, then again weekly until they export. It counts from `localStorage` `medialog:backup`: the last export, or the first check. `lib/backup.ts` holds the timing.
- `Discover.tsx` is the 发现 section: the timetable and the work grids. `useFeed.ts` loads a feed.
- `Reminders.tsx` is the 更新提醒 dialog; `useReminders.ts` holds its state. Both the sidebar and the phone ⋯ menu open it.
- `LibraryHeader.tsx` has the title, the watch-state tabs, and the search, filter and sort row.
- `ItemList.tsx` has the rows, the loading skeleton and the empty states.
- `ItemDialog.tsx` is the add/edit form. It is a shadcn `Dialog` on desktop and a vaul `Drawer` (swipe-to-dismiss bottom sheet) on phones. `MediaLog` keeps the edit target separate from the open flag, so the closing animation still has content to show.
- `Segmented.tsx` is a single-choice ToggleGroup with a Motion knob that slides between options.
- `media.tsx` holds how values look: `CategoryTile`, `Tag`, and the `CATEGORY` and `TAG_TONE` maps.
- `ui/` is **shadcn/ui** (new-york style, vendored source; `components.json` is configured). Toasts use Sonner (`toast()` from `sonner`); `<Toaster>` is rendered in `MediaLog`.

**Adding shadcn components.** On a normal machine, run `npx shadcn@latest add <name>`. The cloud environment's network policy blocks `ui.shadcn.com`, so the CLI fails there. Instead, copy the file from `shadcn-ui/ui` on GitHub (`apps/v4/registry/new-york-v4/ui/<name>.tsx`), then rewrite its imports: `"cn"` becomes `"@/lib/utils"`, and `@/registry/new-york-v4/ui/` becomes `@/components/ui/`. Install any npm dependencies it needs. These files may be edited; for example, `sonner.tsx` drops next-themes, and `hooks/use-mobile.ts` uses `useSyncExternalStore` to satisfy the React lint rules.

**`src/lib/schema.ts` is the single source of truth for the data model.**

- It defines the enum lists (`REGIONS`, `CATEGORIES`, `STATUSES`, `WATCHES`) and the types derived from them.
- `normalise()` is the schema gate. Everything read from storage or an imported file passes through it. Unknown enum values are coerced to defaults, and missing ids or timestamps are filled in.
- To add a value, change it here. Then give it a look in `src/components/media.tsx`: categories need an icon and tint in `CATEGORY`, and watch/status values need a colour in `TAG_TONE`. Both are typed, so the compiler flags a missing one. A new region also goes in `tools/migrate.py`'s `REGIONS` and the README.

**The data format must stay compatible with v1.**

- `RegionFile` is exactly the shape of `data/{region}.json` and of v1's Drive backups. The snapshot export (`{ app: "MediaLog", regions }`) is also unchanged.
- The item key order in `normalise()` matches `tools/migrate.py`. If you add or reorder fields, change both.
- Import (`src/lib/transfer.ts`) accepts either format. A region file's region comes from its `region` field, falling back to the filename.
- Import rejects a file unless every item is an object with a non-empty `name`. `normalise()` would otherwise turn stray values into blank rows. One bad file stops the whole import.
- Import replaces whole regions. Before overwriting a non-empty region, the confirm shows both counts and calls out any region the file would empty. The success toast offers 撤销, which puts the imported regions back as they were.

**Edits are pure functions.**

- `addItem`, `updateItem`, `deleteItem`, `bumpItem` (the +1 button) and `restoreItem` (undo) in `src/lib/items.ts` return `{ library, touched }`.
- `MediaLog.commit()` sets the new state and then persists only the `touched` regions. Moving an item between regions touches both.
- Delete and +1 don't ask for confirmation. Instead they show a toast with 撤销, which calls `restoreItem` to put back the exact previous item at its old position.
- Handlers that can run after a later render, such as undo, must read `libRef.current` rather than the `library` from their render. `commit()` keeps `libRef` up to date.
- `commit()` also calls `sync.schedule(touched)`, so only the regions an edit touched are synced (debounced 1.5 s).
- Persistence (`src/lib/storage.ts`) stores one IndexedDB record per region. Every call is wrapped in a timeout, because in private, hardened, or some headless browsers `indexedDB.open` never settles. When storage is unusable, the app keeps working in memory and says so. Once the library has items, `keepStorage()` asks for persistent storage (`navigator.storage.persist()`), so Chrome and Firefox don't evict it under disk pressure. Chrome decides silently; Firefox may ask the user.

**Google Drive sync** (`src/lib/sync/`, `src/components/useDriveSync.ts`, `src/components/Account.tsx`).

- **Auth** (`src/auth.ts`, Auth.js v5 beta, JWT sessions, no database):
  - Google asks for `drive.file` with offline access. Google's refresh token stays in the encrypted session cookie, and the `jwt` callback refreshes it.
  - The session (`/api/auth/session`) exposes only the short-lived `accessToken`, `expiresAt` and `error` (`RefreshTokenError`, or `DriveScopeMissing` when the Drive box was unticked).
  - `getAccessToken(true)` in `lib/sync/client.ts` forces a refresh by POSTing `{ data: { refresh: true } }` to the session endpoint (`trigger === "update"`). `google-drive.ts` does that once when Drive returns 401.
  - Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Outside Vercel in production mode, Auth.js also needs `AUTH_TRUST_HOST=true`, or every auth route returns 500 (UntrustedHost).
- **Drive layout** (`google-drive.ts`). The browser calls Drive v3 directly. The `MediaLog` folder in My Drive holds `{region}.json` (the bytes of `serialize()`, identical to `data/*.json`, updated in place so Drive's version history accumulates) and `snapshots/medialog-YYYY-MM-DD.json` (snapshot format, at most one per day across devices). With `drive.file` the app only sees files it created. A Cloud project that v1 used for Drive backups therefore finds v1's folder and merges it on first sync.
- **Merge** (`merge.ts`). Three-way merge per region against `base`, the copy both sides agreed on at the last sync, like git. That is how deletions propagate without tombstones, so the file format stays v1's.
  - Edited on one side → that side wins.
  - Edited on both → the newer `updatedAt` wins.
  - Deleted on one side and untouched on the other → deleted.
  - Deleted on one side but edited on the other → the edit is kept.
  - Unchanged regions are never rewritten, and a different order counts as no change.
- **Engine** (`engine.ts`). Per account and region, it stores `{ md5, base }` in IndexedDB (`sync:<email>:<region>`, via `kvGet`/`kvSet` in `storage.ts`). A remote file whose md5 still matches is not downloaded, so a no-op sync is one list call. Syncs run one at a time.
  - **Edits during a sync.** If the local region changed while a sync was awaiting the network, the merge result is re-merged on top of that edit and the region syncs again. Never replace local state with a merge result blindly.
  - **Failures.** Nothing is recorded as synced unless its upload succeeded. A corrupt remote file throws rather than being overwritten.
  - **State on sign-out.** It is kept, so signing back in still knows about deletions made elsewhere meanwhile.
- **When it runs** (`useDriveSync`): on load, after edits, when the tab becomes visible (≥60 s since the last attempt), every 5 min while visible, and on `online`.
  - **Writing results back.** Merged regions come back through `setLocal`, which stores them but does not schedule another sync.
  - **Status.** It reads "syncing" from the moment an edit is queued until no sync is in flight or pending. Never show "synced" while an edit is still waiting.
- **Several tabs** share IndexedDB and the sync base, but each holds its own library in memory (`src/lib/tabs.ts`).
  - Every region a tab stores, from an edit or a sync result, is broadcast on a `BroadcastChannel`. Other tabs adopt it without re-saving or re-syncing.
  - Syncs run under a Web Lock, so only one tab syncs at a time.
  - Without both, a tab with a stale copy would save, or sync, it over another tab's edits.
- The engine is tested against an in-memory fake `Remote` (`engine.test.ts`). Keep it free of React and browser APIs.

**Installable app (PWA)** (`src/app/manifest.ts`, `src/sw/`, `src/app/serwist/`, `src/components/Pwa.tsx`).

- **Manifest and icons.**
  - `manifest.ts` declares a 新增作品 shortcut (`/?new=1`) and a GET `share_target` on `/`. On Android, sharing a page to the app opens the editor with its title and link filled in.
  - `scripts/generate-icons.mjs` draws every icon (lucide's `library` glyph on the brand indigo). That covers `public/icons/` (any, maskable, shortcut) plus `src/app/icon.svg` and `src/app/apple-icon.png`.
- **Service worker** (Serwist).
  - `src/sw/sw.ts` is bundled by `createSerwistRoute` in `src/app/serwist/[path]/route.ts` and prerendered at build to `/serwist/sw.js` (with `Service-Worker-Allowed: /`).
  - It has its own `tsconfig.json`, and the root one excludes `src/sw`.
  - It precaches the build output plus every view's page (`viewPaths()` from `lib/view.ts`). The pages get a random revision per build, so every deploy is a worker update.
  - `ignoreURLParametersMatching: [/.*/]` lets `/?new=1` and share URLs hit the precached page.
  - Google hosts are NetworkOnly. **Never cache `/api/auth/*`**, because the session carries the access token. Serwist's `defaultCache` already makes it NetworkOnly.
- **Registration** (`PwaProvider`, wrapped around the app in `layout.tsx`).
  - The worker registers in production only. `next dev` runs without one, so test offline and install with `build` + `start`.
  - It uses `skipWaiting` + `clientsClaim`. When a new version takes control, `UpdateNotice` shows a toast with a 刷新 action that reloads; it doesn't reload by itself, because that would lose an open edit.
  - Service workers need HTTPS or `localhost`. A phone on the LAN over `http://` gets neither install nor offline.
- **Install UI** (`useInstall`).
  - Chromium's `beforeinstallprompt` is captured at module load, since it can fire before React mounts. It shows 安装应用 in the sidebar and 安装到主屏幕 in the phone ⋯ menu.
  - iOS has no API, so `IosInstallDialog` explains Share → 添加到主屏幕.
  - Nothing is offered when the app already runs standalone.
  - An app installed on iOS has storage separate from Safari, so it starts empty until you sign in or import.
- **Launch URLs.** `launchDraft()` (`src/lib/launch.ts`) turns `new`/`title`/`text`/`url` into a prefill (`DialogTarget.prefill`). It keeps only `http(s)` links. `MediaLog` reads it once after the library loads, then strips the query with `history.replaceState`.
- **Offline start** (`useDriveSync`).
  - The last signed-in account is kept in `localStorage` (`medialog:account`): name, email and image, never tokens. When the session can't be fetched, the app shows that account as offline rather than signed out. It reconnects on `online`, on the poll, or on 立即同步.
  - Sign-out clears the cached account.
  - Session lookups use `fetchSession()` from `lib/sync/client.ts`, not next-auth's `getSession()`. `getSession()` returns `null` for a failed request too, so a network blip would look like a sign-out, or would make `getAccessToken` ask for re-login. `fetchSession()` instead throws a `TypeError` when offline and an `Error` when the server fails.

**发现 feeds** (`src/lib/discover/`, `src/app/api/discover/[feed]/route.ts`, `src/components/Discover.tsx`, `useFeed.ts`).

- **Feeds.** `airing` (AniList airing schedules, two days back to a week ahead), `season` (a season's anime by popularity), `manga` (trending, by country JP/CN/KR) and `movies` (TMDB now playing / upcoming / trending). `feeds.ts` defines them: the UI builds URLs with `feedUrl()`, and the route accepts only what `parseFeed()` reads back (a season within a year of now, the three countries, the three lists); anything else is 404. That keeps the set of upstream requests, and so the caches, small and fixed. Add an option in both places.
- **Server only.** The browser never calls AniList or TMDB, only `/api/discover/*`. `TMDB_API_KEY` stays on the server; it may be the v4 read access token (a JWT, sent as `Bearer`) or the v3 key (sent as `api_key`). `TMDB_REGION` optionally sets whose cinema dates count. Without a key 电影 is not offered: `shownFeeds(false)` leaves it out of the sidebar, the phone tabs, the prerendered pages and the precache, so `/discover/movies` is a 404. The page and the serwist route read `tmdbKey()` at build, so after setting the key, redeploy. The route still answers 503 without a key, and the legal pages mention TMDB only while it is on. `MoviesNotSetUp` in `Discover.tsx` is only reachable if that gating breaks.
- **Caching.** Every upstream call passes `next: { revalidate }`: 30 min for airing, 1 h for season and manga, 6 h for movies. Next's fetch cache matches on URL, method, headers and body, POSTs included, and stores only 200s, so failures are retried. That is why the airing window moves a whole UTC day at a time (`airingWindow`): a body that changed every request would never hit. Responses also carry `s-maxage` for a CDN. AniList allows 90 requests a minute, currently 30; a cold cache costs at most about 20.
- **Normalising.** `anilist.ts` and `tmdb.ts` turn results into `Work` (`types.ts`): title, link, cover, and the library fields the editor prefills (category, region, status). AniList has no Chinese titles, so `titlesOf` prefers a Chinese-looking synonym, then the native title for Chinese and Japanese works, then English. AniList `MOVIE` becomes 电影, like the migration did with 剧场版. Regions come from AniList's `countryOfOrigin` and TMDB's `original_language`. Adult titles are dropped. Upstream errors become `UpstreamError`, and the route answers 502 with the Chinese message.
- **Matching** (`match.ts`). A work is "in the library" when an item's `url` is that work's AniList/TMDB page (`workKey`), or when an item of the same category has exactly one of its titles (`normTitle` ignores case, width, spaces and punctuation). Adding from 发现 saves the link, so those always match; older items rarely do, because their names are Chinese. Tapping a matched work opens its entry instead of adding.
- **Adding.** `MediaLog.pickWork` opens the editor with `DialogTarget.prefill` (name, category, status, `watch: "未看"`, url) in the work's region. After saving from 发现, the toast offers 查看, which switches to the library.
- **Timetable days** (`schedule.ts`) are local: yesterday through six days ahead, so each weekly show appears once. The view fixes `now` when it opens.
- **Client.** `useFeed` keeps results in memory for the session (fresh for 10 min; older copies show while reloading, and stay if the reload fails). Offline, Serwist's default `/api/` rule (network-first, cache `apis`) serves the last copy. Posters come straight from the CDNs as plain `<img>`, not `next/image`. The service worker leaves them alone (`NetworkOnly`), because opaque responses count about 7 MB each against storage quota. Covers fall back to the AniList average colour, then the category icon. Only `https` links and posters are used.
- **Credit.** TMDB's API terms (§3) require their logo and this notice, verbatim apart from the product word: "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." `Credit` shows both under the 电影 feed.
  - The logo is TMDB's official "primary long" SVG, saved at `public/credits/tmdb.svg` (from themoviedb.org/about/logos-attribution). It links to TMDB.
  - It must stay less prominent than the app's own logo; it is 12px tall in faint footer text.
  - Re-check the wording against the terms now and then; it changed once already.
- **Testing.** Normalisers, paging and errors are tested against a stubbed `fetch` with fixtures shaped like the documented schemas. They were written without access to the live APIs, so check against the real ones when you can.

**更新提醒** (`src/lib/track/`, `src/app/api/track/[action]/route.ts`, `src/components/useReminders.ts`, `Reminders.tsx`, the push handlers in `src/sw/sw.ts`).

- **Switched off for now.** `REMINDERS_ENABLED` in `src/lib/track/enabled.ts` is `false` until subscribing has real limits or sign-in (see below). While it is false, the API answers 404, `trackPublicKey()` returns null, and the sidebar and phone menu hide the entry and `RemindersDialog`. All the code below stays in place; flipping the constant brings it back.

- **What is followed** (`targets.ts`). Items whose watch state is 看着: 动画 with an AniList link (target `anilist:<id>`) and 漫画 with a manhuagui link on any of its hosts (target `manhuagui:<id>`). The browser derives the list (`followsOf`) and sends it. The server never sees the rest of the library, and it stores only targets, names and progress (for the notification text) per device.
- **Devices.** A device is identified only by its push subscription; there is no sign-in. Its id is a hash of the endpoint (`subscriberId`). `useReminders` re-sends the follow list 3 s after it changes, and at least daily, using a fingerprint in `localStorage` (`medialog:reminders`). If `/status` or `/test` answers 404 because the server lost the device, it registers again.
- **Server input is untrusted.** `cleanFollows` keeps well-formed targets only, at most 500. `cleanSub` accepts only `https` endpoints on the browsers' push services (`isPushEndpoint`), because the server POSTs to whatever endpoint it is given. At most 200 devices. `/check` needs `Authorization: Bearer $CRON_SECRET`, compared in constant time. Before going public (step 6), subscribing needs real limits, or sign-in.
- **A round** (`engine.ts` `runCheck`, from `GET`/`POST /api/track/check`).
  - **Anime.** One AniList `airingSchedules(mediaId_in…)` request covers the episodes aired since the last round. The window is an hour on the first round and at most two days. Only each show's newest episode is notified. If AniList fails, `lastRun` isn't advanced, so the window isn't skipped.
  - **Manga.** Due comics (not checked for `TRACK_MANGA_HOURS`, default 6) are checked oldest first, three at a time, until a 40 s budget is spent (`maxDuration = 60`).
  - **First sightings.** The first look at a comic only records it, so enabling with 131 comics doesn't announce 131 updates.
  - **Order.** State is saved before sending, so a failed send is dropped rather than repeated.
  - **Messages.** More than three updates for one device become one summary. A 404/410 from the push service removes the device. States of targets nobody follows are dropped.
  - Sources, store and sender are injected, and `engine.test.ts` drives it with fakes.
- **manhuagui** (`manhuagui.ts`). The newest chapter is the chapter link (`/comic/<id>/<chapter>.html`) with the highest chapter id, because ids grow as chapters are uploaded. That avoids depending on the 「更新至」 status markup, which couldn't be checked from the build environment. Adult-flagged comics hide the list LZString-compressed in `__VIEWSTATE` (`lz-string`). A page with no chapter links throws, and the dialog lists it as 读取失败. Requests send a browser User-Agent and Referer. `MANHUAGUI_ORIGIN` can switch the host.
- **Store** (`store.ts`). With Upstash Redis REST env vars (`UPSTASH_REDIS_REST_URL`/`_TOKEN`, or Vercel's `KV_REST_API_URL`/`_TOKEN`) it uses Upstash: hashes `medialog:subs` and `medialog:state`, plus key `medialog:lastrun`, all through `/pipeline`. Otherwise it uses a JSON file (`TRACK_FILE`, default `.data/track.json`, gitignored). Writes are serialised in-process and done by write-then-rename. On serverless hosts (`VERCEL`, `NETLIFY`, `AWS_LAMBDA_FUNCTION_NAME`) the file store is refused, since their disks don't last.
- **Push** (`push.ts`, `config.ts`). `web-push` signs with `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, with a TTL of 12 h. `config.ts` doesn't import web-push, so `page.tsx` can read the public key cheaply. Payloads are `{ title, body, url, tag }`. The worker shows them with `renotify`, the app icon and `public/icons/badge-96.png` (a white glyph, made by `generate-icons.mjs`). Tapping a manga update opens the comic page; an anime update focuses the app or opens it.
- **Client states** (`useReminders`):
  - `unconfigured`: the server has no keys or store.
  - `unsupported`: no Push API, or no service worker (so always under `next dev`).
  - `install`: iOS outside the home-screen app.
  - `blocked`: notification permission was denied.
  - `off` / `on`: from `pushManager.getSubscription()`.
  - If the server refuses a new subscription, the browser subscription is undone.
- **Scheduling** is left to whatever hosts it (see README): an Upstash QStash schedule, Vercel Cron (once a day on Hobby; it sends `CRON_SECRET` itself), or crontab + curl. The site is on Vercel, but no `vercel.json` is committed: Next.js needs no config there, and the only use would be this cron, which waits until 更新提醒 is switched back on.

**Sorting quirks are intentional** and match v1:

- `progress` is free text and sorts by the first number in it. Rows with no number sink to the bottom in both directions.
- Ties fall back to `zh-Hans-CN` collation of `name`, which sorts by pinyin.
- Date sorts start in descending order.

**Styling and UX conventions.**

- **Tokens.** Tailwind v4 with `tw-animate-css`. The theme tokens in `src/app/globals.css` use **shadcn's names**, so its components work unmodified: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `muted-foreground`, `accent`, `destructive`, `border`, `input`, `ring`.
  - **`primary` is the brand colour.** shadcn's `accent` is only a subtle hover background.
  - **Extras:** `faint` (tertiary text), `divider`, `knob` (the segmented selection), `primary-soft` (selected chips), and `green`, `amber`, `red`, `purple`, `sky` for statuses and categories.
  - Use the tokens, never raw colours.
- **Contrast.** Every text colour clears 4.5:1 against `background`, `card` and `muted` in both themes. Re-check if you change one.
- **Themes.** Dark is the default, and light follows `prefers-color-scheme`.
- **Icons.** All icons come from `lucide-react`. Don't use emoji or unicode glyphs as icons. Decorative icons get `aria-hidden`, and icon-only buttons need an `aria-label`.
- **Colour is never the only signal.** Watch and status show a dot plus the word (`Tag`). Categories differ by icon shape as well as tint (`CategoryTile`).
- **Phone layout.** The breakpoint is `md` (768px), and phone-only styles use `max-md:`. On phones:
  - The sidebar becomes `MobileBar`, with region tabs and a ⋯ menu for the account, import/export, 更新提醒 and install.
  - Adding is a floating button.
  - Category, status and sort sit behind a 筛选 toggle.
  - The editor becomes a vaul bottom sheet, which can be swiped down to close.
  - The status and date columns fold into a line under the name.
- **Phone sizing.**
  - Tap targets are at least 40px tall, with 8px gaps.
  - Inputs use 16px text, because iOS Safari zooms into smaller inputs on focus. shadcn's `Input` already does this with `text-base md:text-sm`.
  - Bars and sheets pad for `env(safe-area-inset-*)`.
- **List scrolls inside its card.** On desktop the library view fits the window: `MediaLog` gives the page `h-dvh` and makes `<main>` a flex column, and the rows of `ItemList` scroll under its column header. The title and filter bar therefore stay put. `<main>`, the card and the `<ul>` need `min-h-0`, or the list grows past the window and the whole page scrolls again. The list's wrapper is `flex-1` with `min-h-60`, so a very short window keeps a few rows and scrolls the page instead. Phones and 发现 still scroll the page.
- **Motion.** Animations come from `motion` (`motion/react`). `MediaLog` wraps the app in `<MotionConfig reducedMotion="user">`, and CSS transitions are also cut under `prefers-reduced-motion`. Keep it subtle:
  - the knob sliding between segmented options;
  - a highlight on the row that just changed, plus its progress number rolling in (driven by `flash` in `MediaLog`);
  - the floating add button popping in;
  - the empty states fading in.
- **Keep motion out of plain rows.** The list renders 700+ rows, so only the row that changed gets motion elements; every other row renders plain elements.

**Privacy policy and terms** (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/LegalPage.tsx`).

- Google's consent screen needs both before the app can be published. The sidebar and the phone ⋯ menu link to them, because Google also wants the home page to link to the policy.
- They are Chinese first with an English version below, and they describe exactly what the app stores and sends. That includes the Limited Use statement for Google user data.
- When that changes, update them and `LEGAL_UPDATED`: for example a new third-party host, server-side storage, or 更新提醒 switched back on (it would store push subscriptions and follow lists on the server).
- Like TMDB, Google Analytics appears in the privacy policy only while it is on (`gaId()`).
- `CONTACT_EMAIL` is the public contact address, and should match the consent screen's support email.

**Security.**

- **Rendering.** React escapes text, and nothing uses `dangerouslySetInnerHTML`. Item `url`s render as links only when they are `http(s)`, because imported files are untrusted. Links from upstream APIs are pinned to their own site (`anilist.ts` keeps `siteUrl` only on `https://anilist.co/`), and posters must be `https`.
- **Tokens.** The Google refresh token lives only in the encrypted, httpOnly session cookie. The browser gets the 1-hour access token from `/api/auth/session` and sends it only to `www.googleapis.com`. The scope is `drive.file`, so even a leaked token reaches only the files this app created. Nothing is stored server-side: no database, no user records.
- **Headers** (`next.config.ts`) apply to every route: a CSP, `X-Frame-Options: DENY`, `nosniff`, a referrer policy, `COOP: same-origin`, a permissions policy and HSTS; `X-Powered-By` is off.
  - The CSP is the "without nonces" kind, because the pages are prerendered. `script-src` has to allow `'unsafe-inline'` for Next's inline scripts, so escaping remains the defense against injected script. `connect-src` limits the pages to this site and the Drive API, `img-src` to the poster CDNs and Google avatars, and `frame-ancestors 'none'` blocks framing.
  - The service worker gets its own CSP (`/serwist/:path*`). Posters, avatars and Drive calls pass through it, and inside a worker every fetch counts as `connect-src`. With the pages' policy, every poster failed in production.
  - Dev has no service worker, so check CSP changes with `next build` + `next start` (and `AUTH_TRUST_HOST=true`).
  - A new external host the app calls or loads images from must be added to these lists, or it will be blocked.
- **Google Analytics.** `gaId()` (`lib/analytics.ts`) reads `NEXT_PUBLIC_GA_ID`, set on Vercel for Production only, so local and preview builds aren't counted. It is inlined at build, so changing it needs a redeploy.
  - Only while it is set do the pages' CSP (script, img, connect) and the worker's (connect) allow `GA_HOSTS`, and does `/privacy` describe analytics. The worker passes GA requests straight to the network (`GOOGLE` in `sw.ts`); its default cross-origin rule would cache gtag.js as an opaque response.
  - `Analytics` waits until the URL has no query, because launch URLs (`?title=…&url=…` from a share) carry the user's text and gtag's first `page_view` reports the full address. View switches are counted by GA4's enhanced measurement (history changes), not by the app.
  - **Clicks.** One capture-phase listener in `Analytics` sends `button_click` with `button_name` for every button, link, menu item, tab and toggle. `clickName()` names it by the nearest `data-track`, else the control's `aria-label` or text, minus a trailing count (the region nav's). `Segmented` sets `data-track` from its `name` prop (default: the option), so render extras such as dates stay out. To see `button_name` in GA reports, it is registered as an event-scoped custom dimension there.
  - Nothing from the library or the Google account is sent to GA. Keep it that way; the privacy policy says so. **A control whose label holds user data (an item's name) must set a fixed `data-track`**, as `ItemList` and `Discover` do; otherwise its label is sent.

## Data and tools

- `data/*.json` is the owner's real data. It serves as v1's storage and as the import source for v2.
  - It is untracked and gitignored, so it stays only on the owner's machine. Never commit it again: the repo is public.
  - On 2026-10-10 it was purged from the whole history (`git filter-branch`, force-pushed; every older commit SHA changed). A clone made before then still has the old history with `data/` in it. Never push from one; re-clone instead.
- `tools/migrate.py` was a one-time `.docx` → JSON importer, and the `.docx` files are not committed. **Do not re-run it.** It regenerates every UUID and overwrites `data/`.
