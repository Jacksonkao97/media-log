"use client";

/* MediaLog — the whole app. The library lives in this component's state and
 * is persisted region-by-region to IndexedDB (lib/storage.ts) after every
 * edit. Only the regions an edit touched are rewritten. */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Plus, SearchX } from "lucide-react";
import {
  addItem,
  bumpItem,
  deleteItem,
  filterItems,
  restoreItem,
  sortItems,
  updateItem,
  type Edit,
  type Filters,
  type SortDir,
  type SortKey,
} from "@/lib/items";
import { fmtDate } from "@/lib/format";
import {
  REGIONS,
  WATCHES,
  emptyLibrary,
  type Item,
  type ItemFields,
  type Library,
  type Region,
} from "@/lib/schema";
import { loadLibrary, saveRegion } from "@/lib/storage";
import {
  downloadJson,
  parseImport,
  snapshot,
  type Imported,
} from "@/lib/transfer";
import { MobileBar, Sidebar, type StorageState } from "./Chrome";
import { ItemDialog, type DialogTarget } from "./ItemDialog";
import { EmptyState, ItemList, ListSkeleton } from "./ItemList";
import { LibraryHeader } from "./LibraryHeader";
import { useToast } from "./Toast";
import { Button } from "./ui";

const noFilters = (): Filters => ({
  category: new Set(),
  status: new Set(),
  watch: new Set(),
});

export function MediaLog() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [storage, setStorage] = useState<StorageState>("loading");
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [toastNode, toast] = useToast();

  const deferredQuery = useDeferredValue(query);
  /* The latest library, for handlers that run later than the render that
   * created them (undo from a toast). Updated wherever the library is set. */
  const libRef = useRef<Library | null>(null);
  const pendingWrites = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------ storage */

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((lib) => {
        if (cancelled) return;
        libRef.current = lib;
        setLibrary(lib);
        setStorage("saved");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        libRef.current = emptyLibrary();
        setLibrary(libRef.current);
        setStorage("unavailable");
        toast("浏览器存储不可用（隐私模式？），改动不会被保存", {
          error: true,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  /** Applies an edit and writes the touched regions. Failures are loud — a
   *  silent one would mean the user thinks their edit is saved when it is not. */
  function commit({ library: next, touched }: Edit) {
    libRef.current = next;
    setLibrary(next);
    if (storage === "unavailable") return;
    pendingWrites.current++;
    setStorage("saving");
    Promise.all(touched.map((r) => saveRegion(next, r)))
      .then(() => {
        if (--pendingWrites.current === 0) setStorage("saved");
      })
      .catch((err) => {
        pendingWrites.current--;
        console.error(err);
        setStorage("error");
        toast(`保存失败：${err.message}`, { error: true });
      });
  }

  /** Offers 撤销 that puts `item` back exactly as it was. */
  function undoable(text: string, region: Region, item: Item, index: number) {
    toast(text, {
      action: {
        label: "撤销",
        run: () =>
          libRef.current &&
          commit(restoreItem(libRef.current, region, item, index)),
      },
    });
  }

  /* ------------------------------------------------------------ keyboard */

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const typing =
        ev.target instanceof HTMLElement &&
        ev.target.closest("input, textarea, select, [contenteditable]");
      if (
        ((ev.ctrlKey || ev.metaKey) && ev.key === "k") ||
        (ev.key === "/" && !typing)
      ) {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------ the list */

  const all = useMemo(() => library?.[region].items ?? [], [library, region]);
  // Everything except the watch filter, so each watch tab can show its count.
  const narrowed = useMemo(
    () => filterItems(all, deferredQuery, { ...filters, watch: new Set() }),
    [all, deferredQuery, filters],
  );
  const visible = useMemo(() => {
    const w = filters.watch;
    return sortItems(
      w.size ? narrowed.filter((it) => w.has(it.watch)) : narrowed,
      sortKey,
      sortDir,
    );
  }, [narrowed, filters.watch, sortKey, sortDir]);
  const watchCounts = useMemo(() => {
    const counts = { 全部: narrowed.length } as Record<
      "全部" | Item["watch"],
      number
    >;
    for (const w of WATCHES)
      counts[w] = narrowed.filter((it) => it.watch === w).length;
    return counts;
  }, [narrowed]);

  function sortBy(key: SortKey) {
    setSortKey(key);
    // Dates are most useful newest-first; everything else reads better A→Z.
    setSortDir(key === "createdAt" || key === "updatedAt" ? "desc" : "asc");
  }

  function toggleFilter(kind: "category" | "status", value: string) {
    setFilters((prev) => {
      const set = new Set<string>(prev[kind]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [kind]: set };
    });
  }

  /* -------------------------------------------------------------- CRUD */

  function save(fields: ItemFields, target: Region) {
    const lib = libRef.current;
    if (!lib || !dialog) return;
    const edit = dialog.item
      ? updateItem(lib, dialog.region, dialog.item.id, fields, target)
      : addItem(lib, target, fields);
    if (!edit) return;
    commit(edit);
    setDialog(null);
    setRegion(target);
    toast(dialog.item ? "已保存" : `已添加到 ${target}`);
  }

  function remove() {
    const lib = libRef.current;
    if (!lib || !dialog?.item) return;
    const item = dialog.item;
    const from = dialog.region;
    const index = lib[from].items.findIndex((x) => x.id === item.id);
    commit(deleteItem(lib, from, item.id));
    setDialog(null);
    undoable(`已删除「${item.name}」`, from, item, index);
  }

  function bump(item: Item) {
    const lib = libRef.current;
    if (!lib) return;
    const edit = bumpItem(lib, region, item.id);
    if (!edit) return;
    const index = lib[region].items.findIndex((x) => x.id === item.id);
    commit(edit);
    const now = edit.library[region].items.find((x) => x.id === item.id);
    undoable(`「${item.name}」→ ${now?.progress}`, region, item, index);
  }

  /* ----------------------------------------------------- import/export */

  async function importFiles(files: File[]) {
    if (!libRef.current) return;
    let imported: Imported = {};
    try {
      for (const file of files) {
        imported = {
          ...imported,
          ...parseImport(await file.text(), file.name),
        };
      }
    } catch (err) {
      toast(`导入失败：${(err as Error).message}`, { error: true });
      return;
    }

    const lib = libRef.current;
    const regions = REGIONS.filter((r) => imported[r]);
    const summary = regions
      .map((r) => `${r} ${imported[r]!.items.length} 条`)
      .join("、");
    const overwriting = regions.filter((r) => lib[r].items.length);
    if (
      overwriting.length &&
      !confirm(
        `将用导入的文件覆盖：${overwriting.map((r) => `${r}（现有 ${lib[r].items.length} 条）`).join("、")}。\n\n确定继续？`,
      )
    ) {
      return;
    }

    commit({ library: { ...lib, ...imported }, touched: regions });
    if (!imported[region]) setRegion(regions[0]);
    toast(`已导入：${summary}`);
  }

  function exportSnapshot() {
    const lib = libRef.current;
    if (!lib) return;
    const stamp = fmtDate(new Date().toISOString()).replace(/-/g, "");
    downloadJson(snapshot(lib), `medialog-${stamp}.json`);
    const n = REGIONS.reduce((s, r) => s + lib[r].items.length, 0);
    toast(`已导出 ${n} 条到 medialog-${stamp}.json`);
  }

  const pickFiles = () => fileInput.current?.click();
  const clearFilters = () => {
    setQuery("");
    setFilters(noFilters());
  };
  const openNew = () => setDialog({ region, item: null });

  /* ------------------------------------------------------------- render */

  const libraryEmpty =
    library !== null && REGIONS.every((r) => library[r].items.length === 0);

  let body;
  if (library === null) {
    body = <ListSkeleton />;
  } else if (libraryEmpty) {
    body = (
      <EmptyState
        icon={FileUp}
        title="还没有数据"
        actions={
          <>
            <Button variant="primary" icon={FileUp} onClick={pickFiles}>
              导入数据
            </Button>
            <Button icon={Plus} onClick={openNew}>
              手动新增
            </Button>
          </>
        }
      >
        选择 data/ 文件夹里的
        JSON（可以一次多选），或之前导出的备份文件。数据只保存在这个浏览器里。
      </EmptyState>
    );
  } else if (all.length === 0) {
    body = (
      <EmptyState
        icon={Plus}
        title={`${region} 还没有作品`}
        actions={
          <Button variant="primary" icon={Plus} onClick={openNew}>
            新增作品
          </Button>
        }
      />
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title="没有符合条件的作品"
        actions={
          <Button icon={SearchX} onClick={clearFilters}>
            清除筛选
          </Button>
        }
      >
        换个关键词，或者去掉一些筛选条件。
      </EmptyState>
    );
  } else {
    body = (
      <ItemList
        items={visible}
        onEdit={(item) => setDialog({ region, item })}
        onBump={bump}
      />
    );
  }

  const chrome = {
    library,
    region,
    storage,
    onRegion: setRegion,
    onImport: pickFiles,
    onExport: exportSnapshot,
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar {...chrome} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar {...chrome} />
        <main className="mx-auto w-full max-w-5xl px-8 pt-8 pb-16 max-md:px-4 max-md:pt-5 max-md:pb-28">
          <LibraryHeader
            searchRef={searchRef}
            region={region}
            total={all.length}
            shown={visible.length}
            watchCounts={watchCounts}
            query={query}
            filters={filters}
            sortKey={sortKey}
            sortDir={sortDir}
            onQuery={setQuery}
            onToggle={toggleFilter}
            onWatch={(w) =>
              setFilters((prev) => ({
                ...prev,
                watch: new Set(w ? [w] : []),
              }))
            }
            onSort={sortBy}
            onSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            onClear={clearFilters}
            onNew={openNew}
            ready={library !== null}
            showFilters={all.length > 0}
          />
          <div className="mt-3">{body}</div>
        </main>
      </div>

      {/* Phone: the add button sits where the thumb is. */}
      {library !== null && (
        <button
          type="button"
          onClick={openNew}
          aria-label="新增作品"
          className="bg-accent text-accent-ink fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 cursor-pointer items-center justify-center rounded-2xl shadow-lg transition active:scale-95 md:hidden"
        >
          <Plus aria-hidden className="size-6" />
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={(ev) => {
          const files = Array.from(ev.target.files ?? []);
          ev.target.value = ""; // allow picking the same files again
          if (files.length) importFiles(files);
        }}
      />
      <ItemDialog
        target={dialog}
        onSave={save}
        onDelete={remove}
        onClose={() => setDialog(null)}
      />
      {toastNode}
    </div>
  );
}
