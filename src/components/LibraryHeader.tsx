/* Title, the watch-state tabs (the filter used most) and the search/filter/sort row. */

import { useState, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
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
import { useT } from "./locale";
import { CATEGORY, STATUS_ICON } from "./media";
import { Segmented } from "./Segmented";

const ALL = "全部";
type WatchTab = typeof ALL | Watch;

const SORTS: SortKey[] = [
  "name",
  "progress",
  "year",
  "updatedAt",
  "createdAt",
  "status",
  "category",
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

/* On desktop the page doesn't scroll (the list scrolls inside ItemList), so
 * the title and filter bar stay in view without being sticky. */
export function LibraryHeader({ searchRef, ...p }: Props) {
  const t = useT();
  const watch: WatchTab = [...p.filters.watch][0] ?? ALL;
  const chipCount = p.filters.category.size + p.filters.status.size;
  const narrowed = Boolean(p.query) || chipCount > 0;
  // Phones: category/status/sort live behind a 筛选 button to keep the list in view.
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-4 max-md:sr-only">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.region[p.region]}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
            {p.ready ? t.works(p.total) : t.loading}
            {p.ready && p.shown !== p.total && (
              <span className="text-faint">{t.showing(p.shown)}</span>
            )}
          </p>
        </div>
        <Button onClick={p.onNew} disabled={!p.ready} className="max-md:hidden">
          <Plus aria-hidden />
          {t.add}
        </Button>
      </div>

      {p.showFilters && (
        <div className="mb-1 flex flex-col gap-3 pb-3 md:pt-3">
          <Segmented<WatchTab>
            label={t.watchState}
            value={watch}
            options={[ALL, ...WATCHES]}
            onChange={(w) => p.onWatch(w === ALL ? null : w)}
            className="md:w-fit"
            render={(o) => (
              <>
                {o === ALL ? t.all : t.watch[o]}
                <span className="text-faint text-xs tabular-nums">
                  {p.watchCounts[o]}
                </span>
              </>
            )}
          />

          {/* Desktop: the panel is display: contents, so the search, each chip
              group, 清除筛选 and the sort are separate items of this one
              wrapping row. It wraps between groups, never inside one, so a
              short row never strands the search beside a two-line chip block. */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 md:max-w-xs md:min-w-48 md:basis-56">
              <span className="sr-only">{t.search}</span>
              <Search
                aria-hidden
                className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                ref={searchRef}
                type="search"
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                autoComplete="off"
                enterKeyHint="search"
                className="bg-card pr-10 pl-9 max-md:h-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {p.query ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.clearSearch}
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
              {t.filters}
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
                "w-full flex-wrap items-center gap-2 md:contents",
              )}
            >
              <ChipGroup
                label={t.categoryLabel}
                options={CATEGORIES}
                value={p.filters.category}
                onChange={(v) => p.onFilter("category", v)}
                icon={(c) => CATEGORY[c].icon}
                render={(c) => t.category[c]}
              />
              <ChipGroup
                label={t.statusLabel}
                options={STATUSES}
                value={p.filters.status}
                onChange={(v) => p.onFilter("status", v)}
                icon={(s) => STATUS_ICON[s]}
                render={(s) => t.status[s]}
              />

              {/* Last on desktop, after 清除筛选. */}
              <div className="ml-auto flex items-center gap-1 md:order-1">
                <NativeSelect
                  aria-label={t.sort}
                  value={p.sortKey}
                  onChange={(e) => p.onSort(e.target.value as SortKey)}
                  className="bg-card max-md:h-11"
                >
                  {SORTS.map((k) => (
                    <NativeSelectOption key={k} value={k}>
                      {t.sorts[k]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        p.sortDir === "asc" ? t.ascToggle : t.descToggle
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
                    {p.sortDir === "asc" ? t.asc : t.desc}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {narrowed && (
              <Button
                variant="ghost"
                onClick={p.onClear}
                className="text-muted-foreground px-2.5 text-[13px] max-md:h-11 max-md:w-full max-md:text-sm md:h-8"
              >
                <X aria-hidden />
                {t.clearFilters}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* A multi-select filter: one rounded track per kind (category, status), so
 * the two read as separate groups. Each chip shows only its icon; the label
 * slides open on hover, keyboard focus, or while the chip is on. The label
 * stays in the DOM (clipped), so it is still the chip's accessible name. */
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
  render,
}: {
  label: string;
  options: readonly T[];
  value: Set<T>;
  onChange: (v: string[]) => void;
  icon: (o: T) => LucideIcon;
  render: (o: T) => string;
}) {
  return (
    <ToggleGroup
      type="multiple"
      aria-label={label}
      spacing={1}
      value={[...value]}
      onValueChange={onChange}
      className="bg-muted rounded-full p-1 max-md:flex-wrap max-md:rounded-3xl"
    >
      {options.map((o) => {
        const Icon = icon(o);
        return (
          <ToggleGroupItem
            key={o}
            value={o}
            aria-label={render(o)}
            // Chinese whatever the UI language (analytics).
            data-track={o}
            className="group/chip text-muted-foreground hover:bg-knob hover:text-foreground focus-visible:text-foreground data-[state=on]:bg-primary-soft data-[state=on]:text-foreground data-[state=on]:ring-primary/50 h-7 min-w-7 gap-0 rounded-full! px-1.5 text-[13px] font-normal data-[state=on]:ring-1 max-md:h-10 max-md:min-w-10 max-md:px-3"
          >
            <Icon aria-hidden className="size-4" />
            <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover/chip:grid-cols-[1fr] group-focus-visible/chip:grid-cols-[1fr] group-data-[state=on]/chip:grid-cols-[1fr]">
              {/* Padding on the clipping box itself would stay visible at
                  0fr, so it sits on an inner span. */}
              <span className="overflow-hidden">
                <span className="block pr-0.5 pl-1.5 whitespace-nowrap">
                  {render(o)}
                </span>
              </span>
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
