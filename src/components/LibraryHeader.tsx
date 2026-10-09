/* Title, the watch-state tabs (the filter used most) and the search/filter/sort row. */

import { useState, type Ref } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Filters, SortDir, SortKey } from "@/lib/items";
import {
  CATEGORIES,
  STATUSES,
  WATCHES,
  type Region,
  type Watch,
} from "@/lib/schema";
import { Button, CATEGORY, Chip, IconButton, Kbd, Segmented } from "./ui";

const ALL = "全部";
type WatchTab = typeof ALL | Watch;

const SORTS: [SortKey, string][] = [
  ["name", "名称"],
  ["progress", "进度"],
  ["updatedAt", "最近更新"],
  ["createdAt", "最近添加"],
  ["status", "状态"],
  ["category", "分类"],
];

interface Props {
  searchRef?: Ref<HTMLInputElement>;
  region: Region;
  total: number;
  shown: number;
  /** Per watch state, after the search/category/status filters. */
  watchCounts: Record<WatchTab, number>;
  query: string;
  filters: Filters;
  sortKey: SortKey;
  sortDir: SortDir;
  onQuery: (q: string) => void;
  onToggle: (kind: "category" | "status", value: string) => void;
  onWatch: (w: Watch | null) => void;
  onSort: (key: SortKey) => void;
  onSortDir: () => void;
  onClear: () => void;
  onNew: () => void;
  /** False while the region has nothing to filter, or the library is still loading. */
  showFilters: boolean;
  /** Hides the 新增 button until the library has loaded. */
  ready: boolean;
}

export function LibraryHeader({ searchRef, ...p }: Props) {
  const watch: WatchTab = [...p.filters.watch][0] ?? ALL;
  const chipCount = p.filters.category.size + p.filters.status.size;
  const narrowed = Boolean(p.query) || chipCount > 0;
  // Phones: category/status/sort live behind a 筛选 button to keep the list in view.
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-4 max-md:sr-only">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight max-md:text-xl">
            {p.region}
          </h1>
          <p className="text-ink-dim mt-0.5 text-sm tabular-nums">
            {p.ready ? `${p.total} 部作品` : "加载中…"}
            {p.ready && p.shown !== p.total && (
              <span className="text-ink-faint"> · 显示 {p.shown} 部</span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={p.onNew}
          disabled={!p.ready}
          className="max-md:hidden"
        >
          新增
        </Button>
      </div>

      {/* Sticky on desktop so filters stay in reach while scrolling a long list. */}
      {p.showFilters && (
        <div className="bg-page/90 -mx-1 mb-1 flex flex-col gap-3 px-1 pb-3 backdrop-blur-md md:sticky md:top-0 md:z-20 md:pt-3">
          <Segmented<WatchTab>
            label="观看状态"
            value={watch}
            options={[ALL, ...WATCHES]}
            onChange={(w) => p.onWatch(w === ALL ? null : w)}
            className="w-full md:w-fit"
            render={(o) => (
              <>
                {o}
                <span className="text-ink-faint text-xs tabular-nums">
                  {p.watchCounts[o]}
                </span>
              </>
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 md:max-w-xs md:basis-64">
              <span className="sr-only">搜索</span>
              <Search
                aria-hidden
                className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                ref={searchRef}
                type="search"
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                placeholder="搜索名称或备注"
                autoComplete="off"
                enterKeyHint="search"
                className="border-line bg-panel text-ink placeholder:text-ink-faint focus:border-accent focus:ring-accent/25 h-9 w-full rounded-lg border pr-10 pl-9 text-sm outline-none focus:ring-2 max-md:h-11 max-md:text-base [&::-webkit-search-cancel-button]:hidden"
              />
              {p.query ? (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={() => p.onQuery("")}
                  className="text-ink-faint hover:text-ink absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md max-md:size-10"
                >
                  <X aria-hidden className="size-4" />
                </button>
              ) : (
                <span className="absolute top-1/2 right-2.5 -translate-y-1/2 max-md:hidden">
                  <Kbd>/</Kbd>
                </span>
              )}
            </label>

            <Button
              icon={SlidersHorizontal}
              aria-expanded={panelOpen}
              aria-controls="filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
              className={`md:hidden ${chipCount ? "border-accent/50 bg-accent-dim" : ""}`}
            >
              筛选
              {chipCount > 0 && (
                <span className="bg-accent text-accent-ink rounded-full px-1.5 text-xs leading-5 tabular-nums">
                  {chipCount}
                </span>
              )}
            </Button>

            <div
              id="filter-panel"
              className={`${panelOpen ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 md:flex md:w-auto md:flex-1`}
            >
              <div
                role="group"
                aria-label="分类"
                className="flex gap-1.5 max-md:gap-2"
              >
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    icon={CATEGORY[c].icon}
                    pressed={p.filters.category.has(c)}
                    onClick={() => p.onToggle("category", c)}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
              <div
                role="group"
                aria-label="状态"
                className="flex gap-1.5 max-md:gap-2"
              >
                {STATUSES.map((s) => (
                  <Chip
                    key={s}
                    pressed={p.filters.status.has(s)}
                    onClick={() => p.onToggle("status", s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <label className="sr-only" htmlFor="sort">
                  排序
                </label>
                <select
                  id="sort"
                  value={p.sortKey}
                  onChange={(e) => p.onSort(e.target.value as SortKey)}
                  className="border-line bg-panel text-ink h-9 cursor-pointer rounded-lg border px-2.5 text-sm max-md:h-11"
                >
                  {SORTS.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <IconButton
                  icon={
                    p.sortDir === "asc"
                      ? ArrowUpNarrowWide
                      : ArrowDownWideNarrow
                  }
                  label={
                    p.sortDir === "asc"
                      ? "升序（点击切换）"
                      : "降序（点击切换）"
                  }
                  onClick={p.onSortDir}
                />
              </div>
            </div>

            {narrowed && (
              <Button
                variant="ghost"
                icon={X}
                onClick={p.onClear}
                className="max-md:w-full"
              >
                清除筛选
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
