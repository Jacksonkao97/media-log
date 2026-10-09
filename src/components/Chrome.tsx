/* App chrome: the desktop sidebar and the phone top bar. Both show the same
 * things — regions and the 发现 feeds, where data lives (browser / Google
 * Drive), the account, import/export, installing the app — laid out for
 * their screen. */

import type { ReactNode } from "react";
import {
  Bell,
  BellRing,
  Download,
  Ellipsis,
  Library,
  MonitorDown,
  SquarePlus,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FEED_IDS, type FeedId } from "@/lib/discover/feeds";
import { REGIONS, type Library as Lib, type Region } from "@/lib/schema";
import { REMINDERS_ENABLED } from "@/lib/track/enabled";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/view";
import { AccountCard, StatusDot, SyncMenuItems, isSignedIn } from "./Account";
import { FEEDS } from "./Discover";
import { Segmented } from "./Segmented";
import type { Install } from "./Pwa";
import type { DriveSync } from "./useDriveSync";
import type { Reminders } from "./useReminders";

export type StorageState =
  "loading" | "saving" | "saved" | "error" | "unavailable";

/** The two halves of the app: your own list, and what's new out there. */
const SECTIONS: readonly Section[] = ["library", "discover"];
const SECTION_LABEL: Record<Section, string> = {
  library: "片单",
  discover: "发现",
};

interface Props {
  library: Lib | null;
  section: Section;
  region: Region;
  feed: FeedId;
  storage: StorageState;
  sync: DriveSync;
  install: Install;
  reminders: Reminders;
  onSection: (s: Section) => void;
  onRegion: (r: Region) => void;
  onFeed: (f: FeedId) => void;
  onImport: () => void;
  onExport: () => void;
}

function Logo() {
  return (
    <span className="bg-primary text-primary-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
      <Library aria-hidden className="size-[18px]" />
    </span>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[15px] font-semibold tracking-tight">MediaLog</span>
    </div>
  );
}

/** A sidebar nav entry. */
function NavButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      aria-current={on ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "w-full justify-between px-3 font-normal",
        on ? "bg-accent text-foreground font-medium" : "text-muted-foreground",
      )}
    >
      {children}
    </Button>
  );
}

/** A tab in the phone's second row (regions or feeds). */
function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={on ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-[15px] whitespace-nowrap",
        on
          ? "border-primary text-foreground font-medium"
          : "text-muted-foreground border-transparent",
      )}
    >
      {children}
    </button>
  );
}

const count = (library: Lib | null, r: Region) =>
  library ? library[r].items.length : "–";

export function Sidebar({
  library,
  section,
  region,
  feed,
  storage,
  sync,
  install,
  reminders,
  onRegion,
  onFeed,
  onImport,
  onExport,
}: Props) {
  const remindersOn = reminders.state === "on";
  return (
    <aside className="bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] md:flex">
      <div className="px-2">
        <Brand />
      </div>

      <nav aria-label="区域" className="mt-8">
        <p className="text-faint mb-1.5 px-3 text-xs font-medium">区域</p>
        <ul className="flex flex-col gap-0.5">
          {REGIONS.map((r) => {
            const on = section === "library" && r === region;
            return (
              <li key={r}>
                <NavButton on={on} onClick={() => onRegion(r)}>
                  {r}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      on ? "text-muted-foreground" : "text-faint",
                    )}
                  >
                    {count(library, r)}
                  </span>
                </NavButton>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="发现" className="mt-6">
        <p className="text-faint mb-1.5 px-3 text-xs font-medium">发现</p>
        <ul className="flex flex-col gap-0.5">
          {FEED_IDS.map((f) => {
            const { label, icon: Icon } = FEEDS[f];
            return (
              <li key={f}>
                <NavButton
                  on={section === "discover" && f === feed}
                  onClick={() => onFeed(f)}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon aria-hidden className="text-faint" />
                    {label}
                  </span>
                </NavButton>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto">
        {(REMINDERS_ENABLED || install.mode) && (
          <div className="flex flex-col px-1 pb-3">
            {REMINDERS_ENABLED && (
              <Button
                variant="ghost"
                onClick={() => reminders.setOpen(true)}
                className="text-muted-foreground w-full justify-start"
              >
                {remindersOn ? <BellRing aria-hidden /> : <Bell aria-hidden />}
                更新提醒
                {remindersOn && (
                  <span className="text-faint ml-auto text-xs">已开启</span>
                )}
              </Button>
            )}
            {install.mode && (
              <Button
                variant="ghost"
                onClick={install.install}
                className="text-muted-foreground w-full justify-start"
              >
                <MonitorDown aria-hidden />
                安装应用
              </Button>
            )}
          </div>
        )}

        <div className="border-t px-1 pt-4">
          <AccountCard
            sync={sync}
            storage={storage}
            transfer={{ onImport, onExport, disabled: !library }}
          />
        </div>
      </div>
    </aside>
  );
}

export function MobileBar({
  library,
  section,
  region,
  feed,
  storage,
  sync,
  install,
  reminders,
  onSection,
  onRegion,
  onFeed,
  onImport,
  onExport,
}: Props) {
  return (
    <header className="bg-background/90 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-2.5 pr-1 pl-4">
        <Logo />
        <Segmented
          label="版块"
          value={section}
          options={SECTIONS}
          onChange={onSection}
          render={(s) => SECTION_LABEL[s]}
          className="w-36"
        />
        <div className="flex-1" />
        <StatusDot storage={storage} sync={sync} />
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
          <DropdownMenuContent align="end" className="w-56">
            {/* Signed in, import/export come with the account entries. */}
            <SyncMenuItems
              sync={sync}
              transfer={{ onImport, onExport, disabled: !library }}
              phone
            />
            {sync.status !== "disabled" &&
              sync.status !== "checking" &&
              (!isSignedIn(sync) || REMINDERS_ENABLED || install.mode) && (
                <DropdownMenuSeparator />
              )}
            {!isSignedIn(sync) && (
              <>
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
              </>
            )}
            {REMINDERS_ENABLED && (
              <DropdownMenuItem
                onSelect={() => reminders.setOpen(true)}
                className="h-11 gap-3 text-[15px]"
              >
                {reminders.state === "on" ? (
                  <BellRing aria-hidden className="size-[18px]" />
                ) : (
                  <Bell aria-hidden className="size-[18px]" />
                )}
                更新提醒
                {reminders.state === "on" && (
                  <span className="text-faint ml-auto text-xs">已开启</span>
                )}
              </DropdownMenuItem>
            )}
            {install.mode && (
              <DropdownMenuItem
                onSelect={install.install}
                className="h-11 gap-3 text-[15px]"
              >
                <SquarePlus aria-hidden className="size-[18px]" />
                安装到主屏幕
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {section === "library" ? (
        <nav aria-label="区域" className="flex gap-1 overflow-x-auto px-2">
          {REGIONS.map((r) => (
            <TabButton key={r} on={r === region} onClick={() => onRegion(r)}>
              {r}
              <span className="text-faint text-xs tabular-nums">
                {count(library, r)}
              </span>
            </TabButton>
          ))}
        </nav>
      ) : (
        <nav aria-label="发现" className="flex gap-1 overflow-x-auto px-2">
          {FEED_IDS.map((f) => (
            <TabButton key={f} on={f === feed} onClick={() => onFeed(f)}>
              {FEEDS[f].short}
            </TabButton>
          ))}
        </nav>
      )}
    </header>
  );
}
