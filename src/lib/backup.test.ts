import { describe, expect, it } from "vitest";
import { REMIND_AFTER, SNOOZE, backupCheck } from "./backup";

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 9, 1);

describe("backupCheck", () => {
  it("starts counting at the first check, without reminding", () => {
    expect(backupCheck(null, t0)).toEqual({
      remind: false,
      days: 0,
      since: t0,
    });
  });

  it("stays quiet for 30 days", () => {
    expect(backupCheck(t0, t0 + 29 * DAY)).toMatchObject({
      remind: false,
      since: t0,
    });
  });

  it("reminds after 30 days and snoozes the next reminder a week", () => {
    const now = t0 + 45 * DAY;
    const first = backupCheck(t0, now);
    expect(first).toEqual({
      remind: true,
      days: 45,
      since: now - REMIND_AFTER + SNOOZE,
    });
    expect(backupCheck(first.since, now + 6 * DAY).remind).toBe(false);
    expect(backupCheck(first.since, now + 7 * DAY)).toMatchObject({
      remind: true,
      days: 30,
    });
  });
});
