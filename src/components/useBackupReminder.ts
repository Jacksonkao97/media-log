"use client";

/* Suggests 导出备份 to someone not signed in to Google, once 30 days have
 * passed without an export (lib/backup.ts). Checked once per page load. */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { backupCheck } from "@/lib/backup";

/** When the count started: the last export, or the first check. */
const BACKUP_KEY = "medialog:backup";

const since = {
  get(): number | null {
    try {
      const n = Number(localStorage.getItem(BACKUP_KEY));
      return n > 0 ? n : null;
    } catch {
      return null;
    }
  },
  set(at: number) {
    try {
      localStorage.setItem(BACKUP_KEY, String(at));
    } catch {
      // Storage blocked (private mode): no reminders, which is fine there.
    }
  },
};

/** Call after every export. */
export const markExported = () => since.set(Date.now());

/** `active`: the library has loaded, has items, and nobody is signed in. */
export function useBackupReminder(active: boolean, onExport: () => void) {
  const checked = useRef(false);
  useEffect(() => {
    if (!active || checked.current) return;
    checked.current = true;
    const check = backupCheck(since.get(), Date.now());
    since.set(check.since);
    if (!check.remind) return;
    toast(`已经 ${check.days} 天没有导出备份了`, {
      description:
        "没有登录 Google 同步时，数据只存在这个浏览器里，清除浏览器数据就会丢失。",
      duration: 15_000,
      action: { label: "导出备份", onClick: onExport },
    });
  }, [active, onExport]);
}
