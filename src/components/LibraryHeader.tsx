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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Filters, SortDir, SortKey } from "@/lib/items";
import {
  CATEGORIES,
  STATUSES,
  WATCHES,
  type Region,
  type Watch,
} from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CATEGORY } from "./media";
import { Segmented } from "./Segmented";

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

const CHIP =
  "h-8 rounded-full! border px-3 text-[13px] font-normal text-muted-foreground shadow-none data-[state=on]:border-primary/50 data-[state=on]:bg-primary-soft data-[state=on]:text-foreground max-md:h-10 max-md:px-3.5";

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
  onFilter: (kind: "category" | "status", values: string[]) => void;
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

/* Returns a fragment on purpose: the sticky filter bar's containing block must
 * be <main>, which spans the whole list. Wrapping this in a div stops it sticking. */
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
          <h1 className="text-2xl font-semibold tracking-tight">{p.region}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
            {p.ready ? `${p.total} 部作品` : "加载中…"}
            {p.ready && p.shown !== p.total && (
              <span className="text-faint"> · 显示 {p.shown} 部</span>
            )}
          </p>
        </div>
        <Button onClick={p.onNew} disabled={!p.ready} className="max-md:hidden">
          <Plus aria-hidden />
          新增
        </Button>
      </div>

      {/* Sticky on desktop so filters stay in reach while scrolling a long list. */}
      {p.showFilters && (
        <div className="bg-background/90 -mx-1 mb-1 flex flex-col gap-3 px-1 pb-3 backdrop-blur-md md:sticky md:top-0 md:z-20 md:pt-3">
          <Segmented<WatchTab>
            label="观看状态"
            value={watch}
            options={[ALL, ...WATCHES]}
            onChange={(w) => p.onWatch(w === ALL ? null : w)}
            className="md:w-fit"
            render={(o) => (
              <>
                {o}
                <span className="text-faint text-xs tabular-nums">
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
                className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                ref={searchRef}
                type="search"
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                placeholder="搜索名称或备注"
                autoComplete="off"
                enterKeyHint="search"
                className="bg-card pr-10 pl-9 max-md:h-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {p.query ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="清空搜索"
                  onClick={() => p.onQuery("")}
                  className="text-faint absolute top-1/2 right-1 -translate-y-1/2 max-md:size-10"
                >
                  <X aria-hidden />
                </Button>
              ) : (
                <Kbd className="absolute top-1/2 right-2.5 -translate-y-1/2 max-md:hidden">
                  /
                </Kbd>
              )}
            </label>

            <Button
              variant="outline"
              aria-expanded={panelOpen}
              aria-controls="filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
              className={cn(
                "bg-card h-11 md:hidden",
                chipCount > 0 && "border-primary/50 bg-primary-soft",
              )}
            >
              <SlidersHorizontal aria-hidden />
              筛选
              {chipCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5 tabular-nums">
                  {chipCount}
                </span>
              )}
            </Button>

            <div
              id="filter-panel"
              className={cn(
                panelOpen ? "flex" : "hidden",
                "w-full flex-wrap items-center gap-2 md:flex md:w-auto md:flex-1",
              )}
            >
              <ToggleGroup
                type="multiple"
                aria-label="分类"
                spacing={1.5}
                value={[...p.filters.category]}
                onValueChange={(v) => p.onFilter("category", v)}
                className="max-md:gap-2"
              >
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY[c].icon;
                  return (
                    <ToggleGroupItem
                      key={c}
                      value={c}
                      variant="outline"
                      className={CHIP}
                    >
                      <Icon aria-hidden className="size-3.5" />
                      {c}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <ToggleGroup
                type="multiple"
                aria-label="状态"
                spacing={1.5}
                value={[...p.filters.status]}
                onValueChange={(v) => p.onFilter("status", v)}
                className="max-md:gap-2"
              >
                {STATUSES.map((s) => (
                  <ToggleGroupItem
                    key={s}
                    value={s}
                    variant="outline"
                    className={CHIP}
                  >
                    {s}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="ml-auto flex items-center gap-1">
                <NativeSelect
                  aria-label="排序"
                  value={p.sortKey}
                  onChange={(e) => p.onSort(e.target.value as SortKey)}
                  className="bg-card max-md:h-11"
                >
                  {SORTS.map(([k, label]) => (
                    <NativeSelectOption key={k} value={k}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        p.sortDir === "asc"
                          ? "升序（点击切换）"
                          : "降序（点击切换）"
                      }
                      onClick={p.onSortDir}
                      className="max-md:size-11"
                    >
                      {p.sortDir === "asc" ? (
                        <ArrowUpNarrowWide aria-hidden />
                      ) : (
                        <ArrowDownWideNarrow aria-hidden />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.sortDir === "asc" ? "升序" : "降序"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {narrowed && (
              <Button
                variant="ghost"
                onClick={p.onClear}
                className="max-md:h-11 max-md:w-full"
              >
                <X aria-hidden />
                清除筛选
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
