import { useRef, type ChangeEvent, type Ref } from "react";
import { REGIONS, type Library, type Region } from "@/lib/schema";
import { Button } from "./ui";

export type StorageState =
  "loading" | "saving" | "saved" | "error" | "unavailable";

const STORAGE_LABEL: Record<StorageState, [dot: string, text: string]> = {
  loading: ["bg-ink-faint", "加载中…"],
  saving: ["bg-accent", "保存中…"],
  saved: [
    "bg-green shadow-[0_0_0_3px_color-mix(in_srgb,var(--green)_20%,transparent)]",
    "已保存在本浏览器",
  ],
  error: ["bg-red", "保存失败"],
  unavailable: ["bg-amber", "浏览器存储不可用，改动不会保存"],
};

interface Props {
  ref?: Ref<HTMLElement>;
  library: Library | null;
  region: Region;
  storage: StorageState;
  onRegion: (r: Region) => void;
  onImport: (files: File[]) => void;
  onExport: () => void;
  onNew: () => void;
}

/** Top bar plus region tabs, sticky together. */
export function Header({
  ref,
  library,
  region,
  storage,
  onRegion,
  onImport,
  onExport,
  onNew,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dot, label] = STORAGE_LABEL[storage];
  const ready = library !== null;

  const pick = (ev: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files ?? []);
    ev.target.value = ""; // allow picking the same files again
    if (files.length) onImport(files);
  };

  return (
    <header
      ref={ref}
      className="border-line bg-panel sticky top-0 z-30 border-b"
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-[18px] py-2.5 max-[720px]:gap-x-2 max-[720px]:px-3">
        <div className="flex items-center gap-2">
          <span className="text-accent text-[15px]">◆</span>
          <h1 className="text-[15px] font-[650] tracking-[.2px]">MediaLog</h1>
        </div>

        <div
          className="border-line bg-raised text-ink-dim flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
          title={label}
        >
          <span className={`size-[7px] flex-none rounded-full ${dot}`} />
          <span
            className={`max-[720px]:hidden ${storage === "saved" ? "text-ink" : ""}`}
          >
            {label}
          </span>
        </div>

        <div className="flex-1" />

        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={pick}
        />
        <Button
          variant="ghost"
          disabled={!ready}
          onClick={() => fileInput.current?.click()}
          title="导入 data/ 里的 JSON 或导出的备份"
        >
          导入
        </Button>
        <Button
          variant="ghost"
          disabled={!ready}
          onClick={onExport}
          title="下载所有区域的合并快照"
        >
          导出<span className="max-[720px]:hidden">备份</span>
        </Button>
        <Button variant="primary" disabled={!ready} onClick={onNew}>
          ＋ 新增
        </Button>
      </div>

      <nav
        className="flex gap-0.5 overflow-x-auto px-[18px] max-[720px]:px-3"
        role="tablist"
      >
        {REGIONS.map((r) => {
          const on = r === region;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={on}
              onClick={() => onRegion(r)}
              className={`flex shrink-0 cursor-pointer items-center gap-[7px] border-b-2 px-[15px] pt-[9px] pb-2 whitespace-nowrap max-[720px]:px-3 ${
                on
                  ? "border-accent text-ink font-semibold"
                  : "text-ink-dim hover:text-ink border-transparent"
              }`}
            >
              {r}
              <span
                className={`rounded-full px-1.5 py-[3px] font-mono text-[11px] leading-none ${
                  on ? "bg-accent-dim text-ink" : "bg-raised text-ink-faint"
                }`}
              >
                {library ? library[r].items.length : "–"}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
