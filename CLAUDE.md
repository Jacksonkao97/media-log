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

The components under `src/components/`:

- `Chrome.tsx` holds the desktop `Sidebar` and the phone `MobileBar`. Both show the region nav, the save status, and import/export.
- `LibraryHeader.tsx` has the title, the watch-state tabs, and the search, filter and sort row.
- `ItemList.tsx` has the rows, the loading skeleton and the empty states.
- `ItemDialog.tsx` is the add/edit form.
- `Toast.tsx` shows messages, optionally with an action such as 撤销.
- `ui.tsx` has the shared primitives.

**`src/lib/schema.ts` is the single source of truth for the data model.**

- It defines the enum lists (`REGIONS`, `CATEGORIES`, `STATUSES`, `WATCHES`) and the types derived from them.
- `normalise()` is the schema gate. Everything read from storage or an imported file passes through it. Unknown enum values are coerced to defaults, and missing ids or timestamps are filled in.
- To add a value, change it here. Then give it a look in `src/components/ui.tsx`: categories need an icon and tint in `CATEGORY`, and watch/status values need a colour in `TAG_TONE`. Both are typed, so the compiler flags a missing one. A new region also goes in `tools/migrate.py`'s `REGIONS` and the README.

**The data format must stay compatible with v1.**

- `RegionFile` is exactly the shape of `data/{region}.json` and of v1's Drive backups. The snapshot export (`{ app: "MediaLog", regions }`) is also unchanged.
- The item key order in `normalise()` matches `tools/migrate.py`. If you add or reorder fields, change both.
- Import (`src/lib/transfer.ts`) accepts either format. A region file's region comes from its `region` field, falling back to the filename.

**Edits are pure functions.**

- `addItem`, `updateItem`, `deleteItem`, `bumpItem` (the +1 button) and `restoreItem` (undo) in `src/lib/items.ts` return `{ library, touched }`.
- `MediaLog.commit()` sets the new state and then persists only the `touched` regions. Moving an item between regions touches both.
- Delete and +1 don't ask for confirmation. Instead they show a toast with 撤销, which calls `restoreItem` to put back the exact previous item at its old position.
- Handlers that can run after a later render, such as undo, must read `libRef.current` rather than the `library` from their render. `commit()` keeps `libRef` up to date.
- Drive sync should hook into this same `touched` list instead of re-uploading everything.
- Persistence (`src/lib/storage.ts`) stores one IndexedDB record per region. Every call is wrapped in a timeout, because in private, hardened, or some headless browsers `indexedDB.open` never settles. When storage is unusable, the app keeps working in memory and says so.

**Sorting quirks are intentional** and match v1:

- `progress` is free text and sorts by the first number in it. Rows with no number sink to the bottom in both directions.
- Ties fall back to `zh-Hans-CN` collation of `name`, which sorts by pinyin.
- Date sorts start in descending order.

**Styling and UX conventions.**

- **Tokens.** Tailwind v4. The theme tokens live in `src/app/globals.css` as CSS variables and are exposed as utilities such as `bg-panel`, `text-ink-dim` and `bg-accent/15`. The tokens are `--page`, `--panel`, `--raised`, `--line`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-ink`, `--knob`, `--green`, `--amber`, `--red`, `--purple` and `--sky`. Use the tokens, never raw colours.
- **Contrast.** Every text colour clears 4.5:1 against `--page`, `--panel` and `--raised` in both themes. Re-check if you change one.
- **Themes.** Dark is the default, and light follows `prefers-color-scheme`.
- **Icons.** All icons come from `lucide-react`. Don't use emoji or unicode glyphs as icons. Decorative icons get `aria-hidden`, and icon-only buttons go through `IconButton`, which requires a `label`.
- **Colour is never the only signal.** Watch and status show a dot plus the word (`Tag`). Categories differ by icon shape as well as tint (`CategoryTile`).
- **Phone layout.** The breakpoint is `md` (768px), and phone-only styles use `max-md:`. On phones:
  - The sidebar becomes `MobileBar`, with region tabs and a ⋯ menu for import/export.
  - Adding is a floating button.
  - Category, status and sort sit behind a 筛选 toggle.
  - The dialog becomes a bottom sheet.
  - The status and date columns fold into a line under the name.
- **Phone sizing.**
  - Tap targets are at least 40px tall, with 8px gaps.
  - Inputs use 16px text (`max-md:text-base`), because iOS Safari zooms into smaller inputs on focus.
  - Bars and sheets pad for `env(safe-area-inset-*)`.
- **Sticky filter bar.** On desktop the filter bar sticks while the list scrolls. For that to work it must be a direct child of `<main>`: `LibraryHeader` returns a fragment for this reason. Wrapping it in a div silently breaks the sticking.
- **Motion** stays subtle (150–200 ms) and is switched off under `prefers-reduced-motion`.

**Security.** React escapes text. Item `url`s render as links only when they are `http(s)`, because imported files are untrusted.

## Data and tools

- `data/*.json` is the owner's real data. It serves as v1's storage and as the import source for v2. **Remove it from the repo before deploying anywhere public.**
- `tools/migrate.py` was a one-time `.docx` → JSON importer, and the `.docx` files are not committed. **Do not re-run it.** It regenerates every UUID and overwrites `data/`.
