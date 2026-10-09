# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

MediaLog is a personal anime / manga / movie tracker. This branch (`v2`) rebuilds it as a Next.js app that will become a public website. The v1 version (plain `index.html` + `app.js`, with edits written to `data/*.json` through the File System Access API) stays on `main` until v2 is merged.

UI text and the README are Simplified Chinese; code comments are English.

**Agreed plan, in order:**

1. Port the v1 UI to Next.js, storing data in the browser (done).
2. Google sign-in plus automatic Drive sync: the four region files, plus a daily dated snapshot, because Drive only keeps old versions for about 30 days (done).
3. Make it an installable PWA so it works on phones, including offline (done).
4. "Latest anime/movies" using AniList (anime/manga, including airing schedules) and TMDB (movies) (done).
5. Episode/site trackers with notifications, which need a server-side scheduled job. Vercel's free plan only runs cron once a day.
6. Go public, keeping each user's data in their own Google Drive.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build; also generates route types such as LayoutProps
npm run lint           # ESLint (next lint no longer exists in Next 16)
npm run format         # Prettier; data/ is excluded via .prettierignore
npx tsc --noEmit       # typecheck; needs a build or `next dev` first for the generated types
npx tsc --noEmit -p src/sw   # typecheck the service worker (its own tsconfig, webworker lib)
npm test               # Vitest: src/**/*.test.ts (sync merge and engine, launch params, discover feeds)
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
- To test 发现 without AniList/TMDB (or without network to them), start the server with `NODE_OPTIONS="--import ./fake-upstream.mjs"`: a module that replaces `globalThis.fetch` and answers `https://graphql.anilist.co` and `https://api.themoviedb.org/` from fixtures. Next wraps whatever `fetch` it finds, so its fetch cache still runs and the whole route is exercised. Serve posters with `context.route` on `s4.anilist.co` and `image.tmdb.org`. Set any `TMDB_API_KEY` at build time, or the 电影 feed shows its setup notice.

**Installing packages.** npm 10's resolver can crash with `Cannot read properties of null (reading 'edgesOut')` while resolving optional peer loops, as Vitest's do. If `npm install <pkg>` hits that, retry with `--legacy-peer-deps`. A plain `npm install`/`npm ci` from the lockfile works.

## Architecture

The app is a single client-side page: `src/app/page.tsx` renders `src/components/MediaLog.tsx` (`"use client"`), which holds all state. The only server code is Google sign-in (`src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`) and the 发现 feeds (`src/app/api/discover/[feed]/route.ts`).

`page.tsx` passes `syncEnabled` (all three auth env vars set) and `moviesEnabled` (`TMDB_API_KEY` set). The page is statically prerendered, so `next build` captures them; after changing the env, rebuild. `next dev` re-reads it.

`MediaLog` has two sections, `library` (the regions) and `discover` (发现); `section`, `region` and `feed` are its state. The desktop sidebar lists both; on phones a 片单 / 发现 switch in the top bar picks the section, and the second row shows its regions or feeds.

The components under `src/components/`:

- `Chrome.tsx` holds the desktop `Sidebar` and the phone `MobileBar`. Both show the region and 发现 nav, the save/sync status, the account (from `Account.tsx`), import/export, and the install entry (from `Pwa.tsx`).
- `Discover.tsx` is the 发现 section: the timetable and the work grids. `useFeed.ts` loads a feed.
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

**Edits are pure functions.**

- `addItem`, `updateItem`, `deleteItem`, `bumpItem` (the +1 button) and `restoreItem` (undo) in `src/lib/items.ts` return `{ library, touched }`.
- `MediaLog.commit()` sets the new state and then persists only the `touched` regions. Moving an item between regions touches both.
- Delete and +1 don't ask for confirmation. Instead they show a toast with 撤销, which calls `restoreItem` to put back the exact previous item at its old position.
- Handlers that can run after a later render, such as undo, must read `libRef.current` rather than the `library` from their render. `commit()` keeps `libRef` up to date.
- `commit()` also calls `sync.schedule(touched)`, so only the regions an edit touched are synced (debounced 1.5 s).
- Persistence (`src/lib/storage.ts`) stores one IndexedDB record per region. Every call is wrapped in a timeout, because in private, hardened, or some headless browsers `indexedDB.open` never settles. When storage is unusable, the app keeps working in memory and says so.

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
  - It precaches the build output plus `/`. The `/` entry gets a random revision per build, so every deploy is a worker update.
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
- **Server only.** The browser never calls AniList or TMDB, only `/api/discover/*`. `TMDB_API_KEY` stays on the server; it may be the v4 read access token (a JWT, sent as `Bearer`) or the v3 key (sent as `api_key`). `TMDB_REGION` optionally sets whose cinema dates count. Without a key the 电影 feed shows a setup notice and the route answers 503.
- **Caching.** Every upstream call passes `next: { revalidate }`: 30 min for airing, 1 h for season and manga, 6 h for movies. Next's fetch cache matches on URL, method, headers and body, POSTs included, and stores only 200s, so failures are retried. That is why the airing window moves a whole UTC day at a time (`airingWindow`): a body that changed every request would never hit. Responses also carry `s-maxage` for a CDN. AniList allows 90 requests a minute, currently 30; a cold cache costs at most about 20.
- **Normalising.** `anilist.ts` and `tmdb.ts` turn results into `Work` (`types.ts`): title, link, cover, and the library fields the editor prefills (category, region, status). AniList has no Chinese titles, so `titlesOf` prefers a Chinese-looking synonym, then the native title for Chinese and Japanese works, then English. AniList `MOVIE` becomes 电影, like the migration did with 剧场版. Regions come from AniList's `countryOfOrigin` and TMDB's `original_language`. Adult titles are dropped. Upstream errors become `UpstreamError`, and the route answers 502 with the Chinese message.
- **Matching** (`match.ts`). A work is "in the library" when an item's `url` is that work's AniList/TMDB page (`workKey`), or when an item of the same category has exactly one of its titles (`normTitle` ignores case, width, spaces and punctuation). Adding from 发现 saves the link, so those always match; older items rarely do, because their names are Chinese. Tapping a matched work opens its entry instead of adding.
- **Adding.** `MediaLog.pickWork` opens the editor with `DialogTarget.prefill` (name, category, status, `watch: "未看"`, url) in the work's region. After saving from 发现, the toast offers 查看, which switches to the library.
- **Timetable days** (`schedule.ts`) are local: yesterday through six days ahead, so each weekly show appears once. The view fixes `now` when it opens.
- **Client.** `useFeed` keeps results in memory for the session (fresh for 10 min; older copies show while reloading, and stay if the reload fails). Offline, Serwist's default `/api/` rule (network-first, cache `apis`) serves the last copy. Posters come straight from the CDNs as plain `<img>`, not `next/image`. The service worker leaves them alone (`NetworkOnly`), because opaque responses count about 7 MB each against storage quota. Covers fall back to the AniList average colour, then the category icon. Only `https` links and posters are used.
- **Credit.** TMDB's terms require the notice in `Credit` ("This product uses the TMDB API but is not endorsed or certified by TMDB.") and, for a public site, their logo in an about/credits page, which is still to do (step 6).
- **Testing.** Normalisers, paging and errors are tested against a stubbed `fetch` with fixtures shaped like the documented schemas. They were written without access to the live APIs, so check against the real ones when you can.

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
  - The sidebar becomes `MobileBar`, with region tabs and a ⋯ menu for import/export.
  - Adding is a floating button.
  - Category, status and sort sit behind a 筛选 toggle.
  - The editor becomes a vaul bottom sheet, which can be swiped down to close.
  - The status and date columns fold into a line under the name.
- **Phone sizing.**
  - Tap targets are at least 40px tall, with 8px gaps.
  - Inputs use 16px text, because iOS Safari zooms into smaller inputs on focus. shadcn's `Input` already does this with `text-base md:text-sm`.
  - Bars and sheets pad for `env(safe-area-inset-*)`.
- **Sticky filter bar.** On desktop the filter bar sticks while the list scrolls. For that to work it must be a direct child of `<main>`: `LibraryHeader` returns a fragment for this reason. Wrapping it in a div silently breaks the sticking.
- **Motion.** Animations come from `motion` (`motion/react`). `MediaLog` wraps the app in `<MotionConfig reducedMotion="user">`, and CSS transitions are also cut under `prefers-reduced-motion`. Keep it subtle:
  - the knob sliding between segmented options;
  - a highlight on the row that just changed, plus its progress number rolling in (driven by `flash` in `MediaLog`);
  - the floating add button popping in;
  - the empty states fading in.
- **Keep motion out of plain rows.** The list renders 700+ rows, so only the row that changed gets motion elements; every other row renders plain elements.

**Security.** React escapes text. Item `url`s render as links only when they are `http(s)`, because imported files are untrusted.

## Data and tools

- `data/*.json` is the owner's real data. It serves as v1's storage and as the import source for v2. **Remove it from the repo before deploying anywhere public.**
- `tools/migrate.py` was a one-time `.docx` → JSON importer, and the `.docx` files are not committed. **Do not re-run it.** It regenerates every UUID and overwrites `data/`.
