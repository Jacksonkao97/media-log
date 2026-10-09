"use client";

/* Google account + Drive sync status: a card at the bottom of the desktop
 * sidebar, and menu entries in the phone's ⋯ menu. Import/export live here
 * too: buttons under the card when signed out, account-menu entries when
 * signed in. */

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudOff,
  Download,
  Ellipsis,
  FolderOpen,
  LogOut,
  RefreshCw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StorageState } from "./Chrome";
import type { DriveSync } from "./useDriveSync";

export interface Transfer {
  onImport: () => void;
  onExport: () => void;
  /** The library hasn't loaded yet. */
  disabled: boolean;
}

/** Signed in to Google. False while the session is still being checked, so
 *  the signed-out layout (import/export buttons) shows until we know. */
export const isSignedIn = (sync: DriveSync) =>
  sync.status !== "disabled" &&
  sync.status !== "checking" &&
  sync.account !== null;

/** Re-renders every 30 s so "N 分钟前" stays current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const LOCAL: Record<StorageState, [dot: string, text: string]> = {
  loading: ["bg-faint", "加载中…"],
  saving: ["bg-primary animate-pulse", "保存中…"],
  saved: ["bg-green", "已保存在本浏览器"],
  error: ["bg-red", "保存失败"],
  unavailable: ["bg-amber", "浏览器存储不可用，改动不会保存"],
};

/** One dot + one line for "where is my data": local storage problems first,
 *  then Drive sync when signed in, else the local state. */
export function statusOf(
  storage: StorageState,
  sync: DriveSync,
  now: number,
): [dot: string, text: string] {
  if (storage === "error" || storage === "unavailable") return LOCAL[storage];
  switch (sync.status) {
    case "syncing":
      return ["bg-primary animate-pulse", "正在同步到 Google Drive…"];
    case "synced":
      return [
        "bg-green",
        `已同步到 Google Drive · ${sync.lastSynced ? relTime(sync.lastSynced, now) : ""}`,
      ];
    case "offline":
      return ["bg-faint", "离线，联网后自动同步"];
    case "error":
      return ["bg-red", `同步失败：${sync.error ?? ""}`];
    case "reauth":
      return ["bg-amber", sync.error ?? "需要重新登录 Google"];
    default:
      return LOCAL[storage];
  }
}

export function StatusDot({
  storage,
  sync,
  withText,
}: {
  storage: StorageState;
  sync: DriveSync;
  withText?: boolean;
}) {
  const now = useNow();
  const [dot, text] = statusOf(storage, sync, now);
  return (
    <span
      role="status"
      className="text-muted-foreground inline-flex min-w-0 items-center gap-2 text-xs"
      title={text}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
      <span className={withText ? "truncate" : "sr-only"}>{text}</span>
    </span>
  );
}

function initials(name: string | null, email: string) {
  return (name || email).trim().slice(0, 1).toUpperCase();
}

/** Desktop sidebar card: the data status, then either the sign-in button and
 *  import/export, or the account with a menu that holds import/export. */
export function AccountCard({
  sync,
  storage,
  transfer,
}: {
  sync: DriveSync;
  storage: StorageState;
  transfer: Transfer;
}) {
  const { account } = sync;
  if (!isSignedIn(sync) || !account) {
    const canSignIn = sync.status !== "disabled" && sync.status !== "checking";
    return (
      <div className="flex flex-col gap-2">
        <div className="px-2">
          <StatusDot storage={storage} sync={sync} withText />
        </div>
        {canSignIn && (
          <Button variant="outline" onClick={sync.signIn} className="w-full">
            <Cloud aria-hidden />
            登录 Google 同步
          </Button>
        )}
        <TransferButtons transfer={transfer} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 px-2">
      <div className="flex items-center gap-2.5">
        <Avatar className="size-8">
          {account.image && (
            <AvatarImage
              src={account.image}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="text-xs">
            {initials(account.name, account.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">
            {account.name ?? account.email}
          </p>
          <p className="text-faint truncate text-xs">{account.email}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="账号与同步">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <SyncMenuItems sync={sync} transfer={transfer} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot storage={storage} sync={sync} withText />
        {(sync.status === "error" || sync.status === "reauth") && (
          <Button
            variant="link"
            size="xs"
            className="ml-auto h-auto shrink-0 p-0"
            onClick={sync.status === "reauth" ? sync.signIn : sync.syncNow}
          >
            {sync.status === "reauth" ? "重新登录" : "重试"}
          </Button>
        )}
      </div>
    </div>
  );
}

function TransferButtons({ transfer }: { transfer: Transfer }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        disabled={transfer.disabled}
        onClick={transfer.onImport}
        title="导入 data/ 里的 JSON 或导出的备份"
      >
        <Upload aria-hidden />
        导入
      </Button>
      <Button
        variant="outline"
        disabled={transfer.disabled}
        onClick={transfer.onExport}
        title="下载所有区域的合并快照"
      >
        <Download aria-hidden />
        导出
      </Button>
    </div>
  );
}

/** The account entries, shared by the sidebar's menu and the phone's ⋯ menu.
 *  Signed in, import/export sit right under 立即同步. */
export function SyncMenuItems({
  sync,
  transfer,
  phone,
}: {
  sync: DriveSync;
  transfer: Transfer;
  phone?: boolean;
}) {
  const item = phone ? "h-11 gap-3 text-[15px]" : "";
  const icon = phone ? "size-[18px]" : "";
  if (sync.status === "disabled" || sync.status === "checking") return null;

  if (!sync.account) {
    return (
      <DropdownMenuItem onSelect={sync.signIn} className={item}>
        <Cloud aria-hidden className={icon} />
        登录 Google 同步
      </DropdownMenuItem>
    );
  }
  return (
    <>
      {phone && (
        <DropdownMenuLabel className="text-faint truncate text-xs font-normal">
          {sync.account.email}
        </DropdownMenuLabel>
      )}
      {sync.status === "reauth" ? (
        <DropdownMenuItem onSelect={sync.signIn} className={item}>
          <TriangleAlert aria-hidden className={icon} />
          重新登录 Google
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          onSelect={sync.syncNow}
          disabled={sync.status === "syncing"}
          className={item}
        >
          {sync.status === "offline" ? (
            <CloudOff aria-hidden className={icon} />
          ) : (
            <RefreshCw
              aria-hidden
              className={cn(icon, sync.status === "syncing" && "animate-spin")}
            />
          )}
          立即同步
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onSelect={transfer.onImport}
        disabled={transfer.disabled}
        className={item}
      >
        <Upload aria-hidden className={icon} />
        导入数据
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={transfer.onExport}
        disabled={transfer.disabled}
        className={item}
      >
        <Download aria-hidden className={icon} />
        导出备份
      </DropdownMenuItem>
      {sync.folderUrl && (
        <DropdownMenuItem asChild className={item}>
          <a href={sync.folderUrl} target="_blank" rel="noreferrer noopener">
            <FolderOpen aria-hidden className={icon} />在 Google Drive 中打开
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={sync.signOut} className={item}>
        <LogOut aria-hidden className={icon} />
        退出登录
      </DropdownMenuItem>
    </>
  );
}
