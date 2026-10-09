/* When to remind someone who isn't signed in to Google to export a backup.
 * Their library lives only in this browser, so clearing site data (or
 * Safari's 7-day rule) would lose it. */

const DAY = 86_400_000;
/** Remind once this long has passed without an export. */
export const REMIND_AFTER = 30 * DAY;
/** Ignored, a reminder comes back this much later. */
export const SNOOZE = 7 * DAY;

/** `since` is when the count started: the last export, or the first check
 *  (null before that). Returns whether to remind, how many days it has been,
 *  and the `since` to store, which is pushed forward after a reminder so the
 *  next one waits SNOOZE. */
export function backupCheck(
  since: number | null,
  now: number,
): { remind: boolean; days: number; since: number } {
  if (since === null) return { remind: false, days: 0, since: now };
  const days = Math.floor((now - since) / DAY);
  if (now - since < REMIND_AFTER) return { remind: false, days, since };
  return { remind: true, days, since: now - REMIND_AFTER + SNOOZE };
}
