"use client";

/* Suggests 导出备份 to someone not signed in to Google, once 30 days have
 * passed without an export (lib/backup.ts). Checked once per page load. */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { t as msg } from "@/lib/i18n";
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
    const t = msg();
    toast(t.backupDue(check.days), {
      description: t.backupWhy,
      duration: 15_000,
      action: { label: t.exportBackup, onClick: onExport },
    });
  }, [active, onExport]);
}
