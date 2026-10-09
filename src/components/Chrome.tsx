/* App chrome: the desktop sidebar and the phone top bar. Both show the same
 * things — regions, where data is saved, import/export — laid out for their
 * screen. */

import { Download, Ellipsis, Library, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REGIONS, type Library as Lib, type Region } from "@/lib/schema";
import { cn } from "@/lib/utils";

export type StorageState =
  "loading" | "saving" | "saved" | "error" | "unavailable";

const STORAGE: Record<StorageState, [dot: string, text: string]> = {
  loading: ["bg-faint", "加载中…"],
  saving: ["bg-primary animate-pulse", "保存中…"],
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
      <span className="bg-primary text-primary-foreground inline-flex size-8 items-center justify-center rounded-lg">
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
      className="text-muted-foreground inline-flex items-center gap-2 text-xs"
      title={text}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
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
    <aside className="bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 md:flex">
      <div className="px-2">
        <Brand />
      </div>

      <nav aria-label="区域" className="mt-8">
        <p className="text-faint mb-1.5 px-3 text-xs font-medium">区域</p>
        <ul className="flex flex-col gap-0.5">
          {REGIONS.map((r) => {
            const on = r === region;
            return (
              <li key={r}>
                <Button
                  variant="ghost"
                  aria-current={on ? "page" : undefined}
                  onClick={() => onRegion(r)}
                  className={cn(
                    "w-full justify-between px-3 font-normal",
                    on
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {r}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      on ? "text-muted-foreground" : "text-faint",
                    )}
                  >
                    {count(library, r)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t px-1 pt-4">
        <div className="px-2">
          <StorageStatus state={storage} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={!library}
            onClick={onImport}
            title="导入 data/ 里的 JSON 或导出的备份"
          >
            <Upload aria-hidden />
            导入
          </Button>
          <Button
            variant="outline"
            disabled={!library}
            onClick={onExport}
            title="下载所有区域的合并快照"
          >
            <Download aria-hidden />
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
  return (
    <header className="bg-background/90 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-2 pr-1 pl-4">
        <Brand />
        <div className="flex-1" />
        <StorageStatus state={storage} compact />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="更多"
              disabled={!library}
            >
              <Ellipsis aria-hidden className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={onImport}
              className="h-11 gap-3 text-[15px]"
            >
              <Upload aria-hidden className="size-[18px]" />
              导入数据
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onExport}
              className="h-11 gap-3 text-[15px]"
            >
              <Download aria-hidden className="size-[18px]" />
              导出备份
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              className={cn(
                "flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-[15px] whitespace-nowrap",
                on
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {r}
              <span className="text-faint text-xs tabular-nums">
                {count(library, r)}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
