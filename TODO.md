# TODO

What's left and what could come next. Last updated 2026-10-10. The site is live at https://media-log-seven.vercel.app.

> **Reminder: Google sign-in is in Testing.** Before you demo MediaLog to anyone, add their Google account in [Google Auth Platform](https://console.cloud.google.com/auth/audience) → **Audience → Test users** (100 accounts at most). Otherwise Google refuses their 登录 Google 同步. Without signing in the app still works, but the data stays in that one browser and nothing syncs. This lasts until you choose to publish the app (§3).

## 1. Making the repo public

- [x] **`data/` removed from git history** (2026-10-10). `main` was rewritten without `data/` and force-pushed, and the old branches `v2`, `ccr-55209539-te8b8f` and `ccr-a4984fe7-dffjqx` were deleted. Every older commit SHA changed.
  - GitHub can still show an old commit to anyone who has its SHA until it garbage-collects. Nobody outside has those SHAs, since the repo was private. For a complete purge, ask GitHub Support.
  - Any clone made before the rewrite (another machine, a cloud session) still has the old history. Don't push from it; re-clone.
- [x] **MIT license added.** The README notes that the TMDB logo isn't covered.
- [x] **Secrets check.** Searching every commit found no Google client secret, API key, token, VAPID key or `CRON_SECRET`, and `.env.local` was never committed.
- [x] **`npm audit` (production) is clean.** Serwist was updated to 9.5.13.
- [x] **README and CLAUDE.md refreshed.**
- [ ] **Make the repo public** in GitHub → Settings → General → Danger Zone.
- [ ] **Fill in the repo's About box:** description, website `https://media-log-seven.vercel.app`, and topics (`nextjs`, `pwa`, `anime`, `manga`, `tracker`, `google-drive`).
- [ ] **Turn on secret scanning and push protection** (Settings → Code security; free for public repos).
- [ ] **Push the website commit** in `Jacksonkao97.github.io` once this repo is public. Until then, its "View Source Code" link would 404.
- [ ] **Remaining dev-only advisory.** `braces` (under ESLint's Next config and the shadcn CLI) is flagged for every version, so there's no fixed release to move to yet. It only runs on your machine; update once a fix exists.

## 2. Personal website (`Jacksonkao97.github.io`)

- [x] **MediaLog added to `projects.js`**, first, so it's the Featured Work on the home page. It's committed locally, not pushed (see §1).
  - The thumbnail is a Microlink screenshot of the new `previewLink` (`/discover/season`). A screenshot of `/` would show an empty library, because each visitor's data lives in their own browser. "View Site" still opens `/`.
- [ ] **Add Open Graph / Twitter metadata to MediaLog.** `layout.tsx` only sets a title and description, so a shared link gets no preview card. Add `metadataBase`, `openGraph` and an OG image.

## 3. Unfinished from the plan

- [ ] **Google OAuth app: stays in Testing for now** (decided 2026-10-10). See the reminder at the top. When you want anyone to be able to sign in:
  - choose **Publish app** in Google Auth Platform, and check that `https://media-log-seven.vercel.app/api/auth/callback/google` is an authorised redirect URI;
  - brand verification (your app name and logo on the consent screen) needs a verified domain, the home page and the privacy policy. `/privacy` and `/terms` are ready.
- [ ] **Turn on 电影.** `/discover/movies` is a 404 on the live site, because `TMDB_API_KEY` isn't set on Vercel; it's empty in `.env.local` too. Get a key (README「电影：配置 TMDB」), set it in Vercel, and redeploy.
- [ ] **Bring back 更新提醒** (`REMINDERS_ENABLED` in `src/lib/track/enabled.ts`). Right now anyone could subscribe any device, so it needs:
  - subscriptions tied to Google sign-in: `/api/track/subscribe` checks the session, and caps devices per account;
  - rate limiting, for example `@upstash/ratelimit`, on the same Upstash Redis the store needs on Vercel;
  - a scheduler: QStash every 30 min, because Vercel Hobby cron only runs daily;
  - updated privacy and terms pages, plus `LEGAL_UPDATED`, because push subscriptions and follow lists would be stored on the server;
  - the manhuagui parser tested from Vercel's region. It has never been tested against live pages from a server.
- [ ] **Check 发现 against the real APIs.** The AniList and TMDB normalisers were written against documented schemas, not live responses. Compare real output: titles, regions, covers, airing times.

## 4. Bugs and loose ends

- [ ] **The service worker fails to install in headless Chrome 155.** Every precache write throws `InvalidAccessError: Failed to execute 'put' on 'Cache': Entry already exists`, so the worker never activates, and offline doesn't work. The live site (Serwist 9.5.12) fails the same way, and so does the 9.5.13 build, so the update didn't cause it.
  - A from-scratch install works in Chrome 152 (the desktop app's browser pane): it activates and precaches all 31 entries.
  - **Check your own Chrome 155:** open the site, clear its data (DevTools → Application → Storage → Clear site data), reload, and look under Service workers. If it fails there too, new visitors on Chrome 155 get no offline mode; look for a Chromium or Serwist issue.
- [ ] **The empty library's text mentions 「data/ 文件夹」.** New visitors don't have that folder. Reword it, or fold it into the first-visit welcome (§6).

## 5. Engineering

- [ ] **CI.** Add a GitHub Actions workflow that runs `npm run lint`, `npx tsc --noEmit` (plus `-p src/sw`), `npm test` and `npm run build` on pushes and PRs. Actions are free for public repos.
- [ ] **Dependency updates.** Use Dependabot or Renovate. Minor updates are ready: Next 16.4, React 19.3, radix-ui 1.7. Plan the majors on their own: TypeScript 7, Vitest 5, ESLint 10, motion 14.
- [ ] **npm 12 blocks install scripts** for `esbuild`, `unrs-resolver` and `@swc/core` unless they're approved (`npm install-scripts approve <pkg>`). The build, lint and tests all pass without them, but keep it in mind if one of them breaks.
- [ ] **Watch next-auth.** It's on `5.0.0-beta.32`; follow it to a stable v5 release.
- [ ] **Commit end-to-end tests.** CLAUDE.md describes Playwright setups (a fake Drive, fake AniList/TMDB, push) that get rebuilt by hand each time. Turn them into a `tests/e2e` suite, including a fresh service-worker install (§4).
- [ ] **Add a Chinese 404 page** (`not-found.tsx`) in the app's style. Unknown paths currently get Next's default English page.
- [ ] **Add `robots.txt` and a sitemap** (`app/robots.ts`, `app/sitemap.ts`).
- [ ] **Error monitoring (optional).** Sentry or Vercel Observability. Either would need the privacy policy and the CSP updated.
- [ ] **Run an accessibility check** (Lighthouse or axe) on the live site, in both themes and at phone width.

## 6. Future ideas

**For new visitors**

- **First-visit welcome.** An empty library tells a newcomer nothing. Show a short intro with three choices: try sample data, import, or sign in.
- **English UI.** This is a big change: every string, plus the legal pages. At minimum, add an English README section.

**Library**

- **A 剧集 category** (TV series), maybe 小说 too. K-dramas and Western series have nowhere to go yet. Remember v1 compatibility: v1 doesn't know new enum values.
- **More fields:** rating, start/finish dates, rewatch count. Keep the key order in sync with `tools/migrate.py`.
- **Search AniList/TMDB from the editor** when adding by hand, to fill in the link, category and region. Matching and 更新提醒 then work for those items too.
- **Cover thumbnails** in the list for items with an AniList/TMDB link. Keep plain rows light: there are 700+.
- **A statistics page:** counts by category, region and year, and works finished per month.
- **Bulk edit:** select several rows to change the watch state, move region or delete.
- **Restore from a Drive snapshot inside the app.** List the snapshots, preview the difference, then restore. Today it means downloading and importing.
- **Recently deleted:** a trash that lasts longer than the undo toast.
- **A manual light/dark toggle.** The theme only follows the system today.
- **Custom tags,** or user-defined regions.

**Sources**

- **Bangumi (bgm.tv).** Its API has Chinese titles (`name_cn`), which AniList lacks. It would give better 发现 titles and help match older items with Chinese names.
- **Import from AniList, MyAnimeList, Bangumi or Douban** exports.

**更新提醒, once it's back**

- **More comic sites** besides manhuagui.
- **TV episode reminders** through TMDB, if 剧集 is added.
- **Per-item mute,** quiet hours, or a daily digest instead of instant pushes.
