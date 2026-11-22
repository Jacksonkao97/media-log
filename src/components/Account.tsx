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
import { MESSAGES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StorageState } from "./Chrome";
import { useLocale, useT } from "./locale";
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

const LOCAL_DOT: Record<StorageState, string> = {
  loading: "bg-faint",
  saving: "bg-primary animate-pulse",
  saved: "bg-green",
  error: "bg-red",
  unavailable: "bg-amber",
};

/** One dot + one line for "where is my data": local storage problems first,
 *  then Drive sync when signed in, else the local state. */
export function statusOf(
  storage: StorageState,
  sync: DriveSync,
  now: number,
  locale: Locale = "zh",
): [dot: string, text: string] {
  const t = MESSAGES[locale];
  const local: [string, string] = [LOCAL_DOT[storage], t.local[storage]];
  if (storage === "error" || storage === "unavailable") return local;
  switch (sync.status) {
    case "syncing":
      return ["bg-primary animate-pulse", t.syncing];
    case "synced":
      return [
        "bg-green",
        t.synced(sync.lastSynced ? relTime(sync.lastSynced, now, locale) : ""),
      ];
    case "offline":
      return ["bg-faint", t.offline];
    case "error":
      return ["bg-red", t.syncFailed(sync.error ?? "")];
    case "reauth":
      return ["bg-amber", sync.error ?? t.needReauth];
    default:
      return local;
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
  const [dot, text] = statusOf(storage, sync, now, useLocale());
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
  const t = useT();
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
            {t.signInSync}
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
            <Button variant="ghost" size="icon-sm" aria-label={t.accountMenu}>
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
            {sync.status === "reauth" ? t.signInAgain : t.retry}
          </Button>
        )}
      </div>
    </div>
  );
}

function TransferButtons({ transfer }: { transfer: Transfer }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        disabled={transfer.disabled}
        onClick={transfer.onImport}
        title={t.importTitle}
      >
        <Upload aria-hidden />
        {t.import}
      </Button>
      <Button
        variant="outline"
        disabled={transfer.disabled}
        onClick={transfer.onExport}
        title={t.exportTitle}
      >
        <Download aria-hidden />
        {t.export}
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
  const t = useT();
  if (sync.status === "disabled" || sync.status === "checking") return null;

  if (!sync.account) {
    return (
      <DropdownMenuItem onSelect={sync.signIn} className={item}>
        <Cloud aria-hidden className={icon} />
        {t.signInSync}
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
          {t.reauthGoogle}
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
          {t.syncNow}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onSelect={transfer.onImport}
        disabled={transfer.disabled}
        className={item}
      >
        <Upload aria-hidden className={icon} />
        {t.importData}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={transfer.onExport}
        disabled={transfer.disabled}
        className={item}
      >
        <Download aria-hidden className={icon} />
        {t.exportBackup}
      </DropdownMenuItem>
      {sync.folderUrl && (
        <DropdownMenuItem asChild className={item}>
          <a href={sync.folderUrl} target="_blank" rel="noreferrer noopener">
            <FolderOpen aria-hidden className={icon} />
            {t.openDrive}
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={sync.signOut} className={item}>
        <LogOut aria-hidden className={icon} />
        {t.signOut}
      </DropdownMenuItem>
    </>
  );
}
