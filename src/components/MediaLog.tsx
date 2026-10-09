"use client";

/* MediaLog — the whole app. The library lives in this component's state and
 * is persisted region-by-region to IndexedDB (lib/storage.ts) after every
 * edit. Only the regions an edit touched are rewritten. */

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MotionConfig, motion } from "motion/react";
import { FileUp, Plus, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  type RegionFile,
} from "@/lib/schema";
import { loadLibrary, saveRegion } from "@/lib/storage";
import { launchDraft } from "@/lib/launch";
import { openTabChannel } from "@/lib/tabs";
import {
  downloadJson,
  parseImport,
  snapshot,
  type Imported,
} from "@/lib/transfer";
import { MobileBar, Sidebar, type StorageState } from "./Chrome";
import { IosInstallDialog, useInstall } from "./Pwa";
import { useDriveSync } from "./useDriveSync";
import { ItemDialog, type DialogTarget } from "./ItemDialog";
import { EmptyState, ItemList, ListSkeleton, type Flash } from "./ItemList";
import { LibraryHeader } from "./LibraryHeader";

const noFilters = (): Filters => ({
  category: new Set(),
  status: new Set(),
  watch: new Set(),
});

/** `syncEnabled`: Google sign-in is configured on this server (see src/auth.ts). */
export function MediaLog({ syncEnabled }: { syncEnabled: boolean }) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [storage, setStorage] = useState<StorageState>("loading");
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters);
  // What the editor is for, and whether it is open. Kept apart so the closing
  // animation still has something to show.
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const deferredQuery = useDeferredValue(query);
  /* The latest library, for handlers that run later than the render that
   * created them (undo from a toast). Updated wherever the library is set. */
  const libRef = useRef<Library | null>(null);
  const pendingWrites = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------- drive sync */

  // Stable, and always reading the latest library: the sync engine calls
  // these long after the render that created them.
  const getLocal = useCallback(() => libRef.current!, []);
  /** A region merged by sync: show and store it, but don't sync it again. */
  const tabs = useRef<ReturnType<typeof openTabChannel> | null>(null);
  const setLocal = useCallback((region: Region, file: RegionFile) => {
    const next = { ...libRef.current!, [region]: file };
    libRef.current = next;
    setLibrary(next);
    saveRegion(next, region).catch((err) => console.error(err));
    tabs.current?.announce(region, file);
  }, []);

  // Other tabs' saves (edits and sync results): adopt them, don't re-save.
  useEffect(() => {
    tabs.current = openTabChannel((region, file) => {
      if (!libRef.current) return;
      libRef.current = { ...libRef.current, [region]: file };
      setLibrary(libRef.current);
    });
    return () => tabs.current?.close();
  }, []);
  const install = useInstall();
  const sync = useDriveSync({
    enabled: syncEnabled,
    ready: library !== null,
    getLocal,
    setLocal,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------ storage */

  useEffect(() => {
    let cancelled = false;
    /** Launched from the 新增 shortcut or a share: open a pre-filled editor. */
    const handleLaunch = () => {
      const draft = launchDraft(new URLSearchParams(location.search));
      if (location.search) history.replaceState(null, "", location.pathname);
      if (!draft) return;
      setDialog({ region: REGIONS[0], item: null, prefill: draft });
      setDialogOpen(true);
    };
    loadLibrary()
      .then((lib) => {
        if (cancelled) return;
        libRef.current = lib;
        setLibrary(lib);
        setStorage("saved");
        handleLaunch();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        libRef.current = emptyLibrary();
        setLibrary(libRef.current);
        setStorage("unavailable");
        toast.error("浏览器存储不可用（隐私模式？），改动不会被保存");
        handleLaunch();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Applies an edit and writes the touched regions. Failures are loud — a
   *  silent one would mean the user thinks their edit is saved when it is not. */
  function commit({ library: next, touched }: Edit) {
    libRef.current = next;
    setLibrary(next);
    sync.schedule(touched);
    touched.forEach((r) => tabs.current?.announce(r, next[r]));
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
        toast.error(`保存失败：${err.message}`);
      });
  }

  /** Highlights a row that just changed. */
  const flashRow = (id: string) =>
    setFlash((f) => ({ id, key: (f?.key ?? 0) + 1 }));

  /** Offers 撤销 that puts `item` back exactly as it was. */
  function undoable(text: string, region: Region, item: Item, index: number) {
    toast(text, {
      duration: 5000,
      action: {
        label: "撤销",
        onClick: () => {
          if (!libRef.current) return;
          commit(restoreItem(libRef.current, region, item, index));
          flashRow(item.id);
        },
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

  function setFilterValues(kind: "category" | "status", values: string[]) {
    setFilters((prev) => ({ ...prev, [kind]: new Set(values) }));
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
    setDialogOpen(false);
    setRegion(target);
    // A new item is the last one in its region.
    flashRow(dialog.item?.id ?? edit.library[target].items.at(-1)!.id);
    toast.success(dialog.item ? "已保存" : `已添加到 ${target}`);
  }

  function remove() {
    const lib = libRef.current;
    if (!lib || !dialog?.item) return;
    const item = dialog.item;
    const from = dialog.region;
    const index = lib[from].items.findIndex((x) => x.id === item.id);
    commit(deleteItem(lib, from, item.id));
    setDialogOpen(false);
    undoable(`已删除「${item.name}」`, from, item, index);
  }

  function bump(item: Item) {
    const lib = libRef.current;
    if (!lib) return;
    const edit = bumpItem(lib, region, item.id);
    if (!edit) return;
    const index = lib[region].items.findIndex((x) => x.id === item.id);
    commit(edit);
    flashRow(item.id);
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
      toast.error(`导入失败：${(err as Error).message}`);
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
    toast.success(`已导入：${summary}`);
  }

  function exportSnapshot() {
    const lib = libRef.current;
    if (!lib) return;
    const stamp = fmtDate(new Date().toISOString()).replace(/-/g, "");
    downloadJson(snapshot(lib), `medialog-${stamp}.json`);
    const n = REGIONS.reduce((s, r) => s + lib[r].items.length, 0);
    toast.success(`已导出 ${n} 条到 medialog-${stamp}.json`);
  }

  const pickFiles = () => fileInput.current?.click();
  const clearFilters = () => {
    setQuery("");
    setFilters(noFilters());
  };
  const openEditor = (target: DialogTarget) => {
    setDialog(target);
    setDialogOpen(true);
  };
  const openNew = () => openEditor({ region, item: null });

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
            <Button onClick={pickFiles}>
              <FileUp aria-hidden />
              导入数据
            </Button>
            <Button variant="outline" onClick={openNew}>
              <Plus aria-hidden />
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
          <Button onClick={openNew}>
            <Plus aria-hidden />
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
          <Button variant="outline" onClick={clearFilters}>
            <SearchX aria-hidden />
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
        flash={flash}
        onEdit={(item) => openEditor({ region, item })}
        onBump={bump}
      />
    );
  }

  const chrome = {
    library,
    region,
    storage,
    sync,
    onRegion: setRegion,
    onImport: pickFiles,
    onExport: exportSnapshot,
    install,
  };

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
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
                onFilter={setFilterValues}
                onWatch={(w) =>
                  setFilters((prev) => ({
                    ...prev,
                    watch: new Set(w ? [w] : []),
                  }))
                }
                onSort={sortBy}
                onSortDir={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
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
            <motion.button
              type="button"
              onClick={openNew}
              aria-label="新增作品"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="bg-primary text-primary-foreground focus-visible:ring-ring/50 fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 cursor-pointer items-center justify-center rounded-2xl shadow-lg outline-none focus-visible:ring-[3px] md:hidden"
            >
              <Plus aria-hidden className="size-6" />
            </motion.button>
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
          <IosInstallDialog install={install} />
          <ItemDialog
            target={dialog}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSave={save}
            onDelete={remove}
          />
          {/* Phones: above the floating add button. */}
          <Toaster
            position="bottom-center"
            mobileOffset={{
              bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
            }}
          />
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
