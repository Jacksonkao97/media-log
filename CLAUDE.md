# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

MediaLog is a personal anime / manga / movie tracker. This branch (`v2`) rebuilds it as a Next.js app that will become a public website. The v1 version (plain `index.html` + `app.js`, with edits written to `data/*.json` through the File System Access API) stays on `main` until v2 is merged.

UI text and the README are Simplified Chinese; code comments are English.

**Agreed plan, in order:**

1. Port the v1 UI to Next.js, storing data in the browser (done).
2. Google sign-in plus automatic Drive sync: the four region files, plus a daily dated snapshot, because Drive only keeps old versions for about 30 days.
3. Make it an installable PWA so it works on phones.
4. "Latest anime/movies" using AniList (anime/manga, including airing schedules) and TMDB (movies).
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
```

There is no test runner yet. To check behaviour, drive the running app in a browser. When automating the import with Playwright, pass files to `setInputFiles` as `{ name, mimeType, buffer }`: headless Chromium silently drops files whose path contains non-ASCII characters, such as `data/日本.json`.

## Architecture

The app is currently a single client-side page: `src/app/page.tsx` renders `src/components/MediaLog.tsx` (`"use client"`), which holds all state. There is no server code yet.

**`src/lib/schema.ts` is the single source of truth for the data model.**

- It defines the enum lists (`REGIONS`, `CATEGORIES`, `STATUSES`, `WATCHES`) and the types derived from them.
- `normalise()` is the schema gate. Everything read from storage or an imported file passes through it. Unknown enum values are coerced to defaults, and missing ids or timestamps are filled in.
- To add a value, change it here. Then add its colour to `TONE` in `src/components/ui.tsx`, which is typed so the compiler flags a missing one. A new region also goes in `tools/migrate.py`'s `REGIONS` and the README.

**The data format must stay compatible with v1.**

- `RegionFile` is exactly the shape of `data/{region}.json` and of v1's Drive backups. The snapshot export (`{ app: "MediaLog", regions }`) is also unchanged.
- The item key order in `normalise()` matches `tools/migrate.py`. If you add or reorder fields, change both.
- Import (`src/lib/transfer.ts`) accepts either format. A region file's region comes from its `region` field, falling back to the filename.

**Edits are pure functions.**

- `addItem`, `updateItem` and `deleteItem` in `src/lib/items.ts` return `{ library, touched }`.
- `MediaLog.commit()` sets the new state and then persists only the `touched` regions. Moving an item between regions touches both.
- Drive sync should hook into this same `touched` list instead of re-uploading everything.
- Persistence (`src/lib/storage.ts`) stores one IndexedDB record per region. Every call is wrapped in a timeout, because in private, hardened, or some headless browsers `indexedDB.open` never settles. When storage is unusable, the app keeps working in memory and says so.

**Sorting quirks are intentional** and match v1:

- `progress` is free text and sorts by the first number in it. Rows with no number sink to the bottom in both directions.
- Ties fall back to `zh-Hans-CN` collation of `name`, which sorts by pinyin.
- Date columns start in descending order.

**Styling.**

- Tailwind v4. The theme tokens live in `src/app/globals.css` as CSS variables (`--page`, `--panel`, `--raised`, `--line`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`…) and are exposed as utilities such as `bg-panel`, `text-ink-dim` and `bg-accent/15`. Use the tokens rather than raw colours.
- Dark is the default, and light follows `prefers-color-scheme`.
- The phone breakpoint is `max-[720px]`. Below it, the status, category and date columns are hidden, and status and category show as pills under the name.

**Security.** React escapes text. Item `url`s render as links only when they are `http(s)`, because imported files are untrusted.

## Data and tools

- `data/*.json` is the owner's real data. It serves as v1's storage and as the import source for v2. **Remove it from the repo before deploying anywhere public.**
- `tools/migrate.py` was a one-time `.docx` → JSON importer, and the `.docx` files are not committed. **Do not re-run it.** It regenerates every UUID and overwrites `data/`.
