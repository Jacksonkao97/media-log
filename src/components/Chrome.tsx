/* App chrome: the desktop sidebar and the phone top bar. Both show the same
 * things — regions, where data is saved, import/export — laid out for their
 * screen. */

import { useRef, type ReactNode } from "react";
import {
  Download,
  Ellipsis,
  Library,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { REGIONS, type Library as Lib, type Region } from "@/lib/schema";
import { Button, IconButton } from "./ui";

export type StorageState =
  "loading" | "saving" | "saved" | "error" | "unavailable";

const STORAGE: Record<StorageState, [dot: string, text: string]> = {
  loading: ["bg-ink-faint", "加载中…"],
  saving: ["bg-accent animate-pulse", "保存中…"],
  saved: ["bg-green", "已保存在本浏览器"],
  error: ["bg-red", "保存失败"],
  unavailable: ["bg-amber", "浏览器存储不可用，改动不会保存"],
};

interface Props {
  library: Lib | null;
  region: Region;
  storage: StorageState;
  onRegion: (r: Region) => void;
  onImport: () => void;
  onExport: () => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-accent text-accent-ink inline-flex size-8 items-center justify-center rounded-lg">
        <Library aria-hidden className="size-[18px]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">MediaLog</span>
    </div>
  );
}

function StorageStatus({
  state,
  compact,
}: {
  state: StorageState;
  compact?: boolean;
}) {
  const [dot, text] = STORAGE[state];
  return (
    <span
      role="status"
      className="text-ink-dim inline-flex items-center gap-2 text-xs"
      title={text}
    >
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className={compact ? "sr-only" : ""}>{text}</span>
    </span>
  );
}

const count = (library: Lib | null, r: Region) =>
  library ? library[r].items.length : "–";

export function Sidebar({
  library,
  region,
  storage,
  onRegion,
  onImport,
  onExport,
}: Props) {
  return (
    <aside className="border-line bg-panel sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 md:flex">
      <div className="px-2">
        <Brand />
      </div>

      <nav aria-label="区域" className="mt-8">
        <p className="text-ink-faint mb-1.5 px-3 text-xs font-medium">区域</p>
        <ul className="flex flex-col gap-0.5">
          {REGIONS.map((r) => {
            const on = r === region;
            return (
              <li key={r}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => onRegion(r)}
                  className={`flex h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-sm transition ${
                    on
                      ? "bg-raised text-ink font-medium"
                      : "text-ink-dim hover:bg-raised/60 hover:text-ink"
                  }`}
                >
                  {r}
                  <span
                    className={`text-xs tabular-nums ${on ? "text-ink-dim" : "text-ink-faint"}`}
                  >
                    {count(library, r)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-line mt-auto flex flex-col gap-3 border-t px-1 pt-4">
        <div className="px-2">
          <StorageStatus state={storage} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            icon={Upload}
            disabled={!library}
            onClick={onImport}
            title="导入 data/ 里的 JSON 或导出的备份"
          >
            导入
          </Button>
          <Button
            icon={Download}
            disabled={!library}
            onClick={onExport}
            title="下载所有区域的合并快照"
          >
            导出
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function MobileBar({
  library,
  region,
  storage,
  onRegion,
  onImport,
  onExport,
}: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const run = (fn: () => void) => () => {
    menu.current?.hidePopover();
    fn();
  };

  return (
    <header className="border-line bg-page/90 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-2 pr-1 pl-4">
        <Brand />
        <div className="flex-1" />
        <StorageStatus state={storage} compact />
        <IconButton
          icon={Ellipsis}
          label="更多"
          popoverTarget="app-menu"
          disabled={!library}
        />
        <div
          ref={menu}
          id="app-menu"
          popover="auto"
          className="border-line bg-panel text-ink fixed inset-auto top-[calc(3.5rem+env(safe-area-inset-top))] right-2 m-0 w-48 rounded-xl border p-1.5 shadow-xl"
        >
          <MenuItem icon={Upload} onClick={run(onImport)}>
            导入数据
          </MenuItem>
          <MenuItem icon={Download} onClick={run(onExport)}>
            导出备份
          </MenuItem>
        </div>
      </div>

      <nav aria-label="区域" className="flex gap-1 overflow-x-auto px-2">
        {REGIONS.map((r) => {
          const on = r === region;
          return (
            <button
              key={r}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onRegion(r)}
              className={`flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-[15px] whitespace-nowrap ${
                on
                  ? "border-accent text-ink font-medium"
                  : "text-ink-dim border-transparent"
              }`}
            >
              {r}
              <span className="text-ink-faint text-xs tabular-nums">
                {count(library, r)}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-raised flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-[15px]"
    >
      <Icon aria-hidden className="text-ink-dim size-[18px]" />
      {children}
    </button>
  );
}
