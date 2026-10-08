# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MediaLog is a personal anime / manga / movie tracker with **no backend, no build step, no dependencies, and no test suite**: `index.html` + `styles.css` + `app.js` + `drive.js`, with data in `data/{region}.json`. The UI text and README are Simplified Chinese; code comments are English.

## Running and checking

```bash
python3 -m http.server 8000          # then open http://localhost:8000
node --check app.js && node --check drive.js   # syntax check only; there is no linter or test runner
```

- Served over http, `data/*.json` loads automatically via `fetch` (read-only until a folder is connected).
- Opening `index.html` via `file://` cannot fetch the JSON at all (CORS), so the table stays empty until **连接文件夹** is clicked.
- Editing requires Chrome/Edge (File System Access API). Firefox/Safari stay read-only by design.
- Google Drive sync only works from an http origin, and the OAuth client is registered for the exact origin `http://localhost:8000`. Changing the port breaks sign-in.

## Architecture

**Two classic scripts sharing one global scope.** `drive.js` is not a module. It loads after `app.js` and directly uses its globals: `REGIONS`, `store`, `readOnly`, `toast`, `esc`, `normalise`, `saveRegion`, `render`. Renaming or changing the signature of any of these in `app.js` silently breaks Drive sync.

**Storage model (`app.js`).**
- `store` is the in-memory source of truth: `region -> { region, version, updatedAt, items[] }`, one entry per file in `data/`.
- Every mutation edits `store[...]` in place, calls `saveRegion(region)` for each touched region, then `render()` re-renders everything from `state` (active tab, sort, search, filters) using `innerHTML` templates.
- `saveRegion` is debounced (250 ms) per region and writes through the `FileSystemDirectoryHandle` (`dirHandle`). It is a no-op when `readOnly` is true.
- Changing an item's region in the edit dialog removes it from one region's `items` and pushes it into the other, so both files are rewritten.
- The directory handle is stored in IndexedDB (`medialog` DB, `kv` store, key `dir`). On a new session Chrome usually drops the permission, so the handle is kept in `pendingHandle` and the connect button becomes a one-click **重新连接** (reconnect) without reopening the folder picker. All IndexedDB calls go through `withTimeout`, because in private, hardened, or headless browsers `indexedDB.open` can hang forever.

**On-disk format must stay byte-stable.** Files are written as `JSON.stringify(payload, null, 2) + '\n'` with LF endings (enforced by `.gitattributes`). Item key order is fixed by `normalise()` in `app.js` and mirrored in `tools/migrate.py`. If you add or reorder fields, change both, or the next save rewrites every file as a large no-op diff. `data/` is committed to git as the edit history (`git add data/ && git commit -m "log: 更新进度"`).

**`normalise()` is the schema gate.** Anything loaded from disk, fetch, or a Drive restore passes through it. Unknown `watch`/`status`/`category` values are silently coerced to defaults (`看着` / `未完结` / `动画`), and missing `id`/timestamps are filled in.

**Enum values are Chinese strings hard-coded in several places.** To add a region, category, status, or watch state, update all of these:
- `app.js`: `REGIONS`, `CATEGORIES`, `STATUSES`, `WATCHES`, the `*_CLASS` maps, and `RANK`
- `index.html`: the `<select>` options
- `styles.css`: the pill classes (`w-*`, `s-*`, `c-*`)
- `tools/migrate.py`: `REGIONS`
- `drive.js`: the "4 个 JSON" hint text
- the README tables

**Sorting quirks are intentional** (and documented in the README):
- `progress` is free text; it sorts by the first number in the string (`progNum`). Rows with no number sink to the bottom in **both** directions.
- Ties fall back to `zh-Hans-CN` collation of `name`, which sorts by pinyin.
- Date columns default to descending when first clicked.

**Rendering safety.** All HTML is built with template strings, so every user-provided value must go through `esc()`.

**Drive backup (`drive.js`).**
- Uses the `drive.file` scope, so the app sees only files it created. It always uses its own `MediaLog` folder.
- The access token lives only in memory. The client ID, folder ID, and last-sync time live in `localStorage` under `medialog:gdrive:*`.
- Upload uploads the four region files exactly as the app writes them (`JSON.stringify(store[region], null, 2)`), not a bundled snapshot. Existing files are updated in place with a `PATCH` (`uploadType=media`), which keeps the same file ID and so preserves Drive's version history.
- Restore is refused in read-only mode. Restored data goes through `normalise()` and then `saveRegion()`, so it is written to `data/`.
- The Google Identity script (`accounts.google.com/gsi/client`) loads lazily on first sync. Without Drive use, the app makes no external requests. Keep it that way.

## `tools/migrate.py`

A one-time importer that turned three `.docx` files (not committed) into `data/*.json` using heuristic parsing of Chinese status markers. **Do not re-run it against the current data.** It regenerates every UUID and overwrites `data/`, wiping all edits made in the app since the migration.
