"use client";

/* MediaLog — the whole app. The library lives in this component's state and
 * is persisted region-by-region to IndexedDB (lib/storage.ts) after every
 * edit. Only the regions an edit touched are rewritten. */

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  addItem,
  deleteItem,
  filterItems,
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
import { Header, type StorageState } from "./Header";
import { ItemDialog, type DialogTarget } from "./ItemDialog";
import { ItemTable } from "./ItemTable";
import { useToast } from "./Toast";
import { Toolbar } from "./Toolbar";

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
  const pendingWrites = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [headH, setHeadH] = useState(0);

  /* ------------------------------------------------------------ storage */

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((lib) => {
        if (cancelled) return;
        setLibrary(lib);
        setStorage("saved");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setLibrary(emptyLibrary());
        setStorage("unavailable");
        toast("浏览器存储不可用（隐私模式？），改动不会被保存", true);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  /** Applies an edit and writes the touched regions. Failures are loud — a
   *  silent one would mean the user thinks their edit is saved when it is not. */
  function commit({ library: next, touched }: Edit) {
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
        toast(`保存失败：${err.message}`, true);
      });
  }

  /* ----------------------------------------------------------------- ui */

  // The table header sticks just below the top bar, whose height changes when it wraps.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => library?.[region].items ?? [], [library, region]);
  const visible = useMemo(
    () => sortItems(filterItems(all, deferredQuery, filters), sortKey, sortDir),
    [all, deferredQuery, filters, sortKey, sortDir],
  );
  const stats = useMemo(() => {
    const count = (w: Item["watch"]) =>
      all.filter((it) => it.watch === w).length;
    return {
      shown: visible.length,
      total: all.length,
      watching: count("看着"),
      done: count("看完了"),
      unseen: count("未看"),
    };
  }, [all, visible]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      // Dates are most useful newest-first; everything else reads better A→Z.
      setSortDir(key === "createdAt" || key === "updatedAt" ? "desc" : "asc");
    }
  }

  function toggleFilter(kind: keyof Filters, value: string) {
    setFilters((prev) => {
      const set = new Set<string>(prev[kind]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [kind]: set };
    });
  }

  /* -------------------------------------------------------------- CRUD */

  function save(fields: ItemFields, target: Region) {
    if (!library || !dialog) return;
    const edit = dialog.item
      ? updateItem(library, dialog.region, dialog.item.id, fields, target)
      : addItem(library, target, fields);
    if (!edit) return;
    commit(edit);
    setDialog(null);
    setRegion(target);
    toast(dialog.item ? "已保存" : `已添加到 ${target}`);
  }

  function remove() {
    if (!library || !dialog?.item) return;
    if (!confirm(`删除「${dialog.item.name}」？`)) return;
    commit(deleteItem(library, dialog.region, dialog.item.id));
    setDialog(null);
    toast("已删除");
  }

  /* ----------------------------------------------------- import/export */

  async function importFiles(files: File[]) {
    if (!library) return;
    let imported: Imported = {};
    try {
      for (const file of files) {
        imported = {
          ...imported,
          ...parseImport(await file.text(), file.name),
        };
      }
    } catch (err) {
      toast(`导入失败：${(err as Error).message}`, true);
      return;
    }

    const regions = REGIONS.filter((r) => imported[r]);
    const summary = regions
      .map((r) => `${r} ${imported[r]!.items.length} 条`)
      .join("、");
    const overwriting = regions.filter((r) => library[r].items.length);
    if (
      overwriting.length &&
      !confirm(
        `将用导入的文件覆盖：${overwriting.map((r) => `${r}（现有 ${library[r].items.length} 条）`).join("、")}。\n\n确定继续？`,
      )
    ) {
      return;
    }

    commit({ library: { ...library, ...imported }, touched: regions });
    if (!imported[region]) setRegion(regions[0]);
    toast(`已导入：${summary}`);
  }

  function exportSnapshot() {
    if (!library) return;
    const stamp = fmtDate(new Date().toISOString()).replace(/-/g, "");
    downloadJson(snapshot(library), `medialog-${stamp}.json`);
    const n = REGIONS.reduce((s, r) => s + library[r].items.length, 0);
    toast(`已导出 ${n} 条到 medialog-${stamp}.json`);
  }

  /* ------------------------------------------------------------- render */

  const libraryEmpty =
    library !== null && REGIONS.every((r) => library[r].items.length === 0);
  const emptyText =
    library === null
      ? "加载中…"
      : libraryEmpty
        ? "还没有数据。点右上角「导入」选择 data/ 文件夹里的 JSON（可以一次多选），或点「＋ 新增」开始。"
        : all.length === 0
          ? `${region} 还没有条目，点右上角「＋ 新增」开始。`
          : visible.length === 0
            ? "没有符合筛选条件的条目。"
            : null;

  return (
    <div style={{ "--head-h": `${headH}px` } as CSSProperties}>
      <Header
        ref={headerRef}
        library={library}
        region={region}
        storage={storage}
        onRegion={setRegion}
        onImport={importFiles}
        onExport={exportSnapshot}
        onNew={() => setDialog({ region, item: null })}
      />

      <Toolbar
        ref={searchRef}
        query={query}
        filters={filters}
        stats={stats}
        onQuery={setQuery}
        onToggle={toggleFilter}
        onClear={() => {
          setQuery("");
          setFilters(noFilters());
        }}
      />

      <main className="px-[18px] pb-[60px] max-[720px]:px-3">
        {all.length > 0 && (
          <ItemTable
            items={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={sortBy}
            onEdit={(item) => setDialog({ region, item })}
          />
        )}
        {emptyText && (
          <p className="text-ink-faint py-14 text-center">{emptyText}</p>
        )}
      </main>

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
