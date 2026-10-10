/* Google Analytics (GA4). On only when NEXT_PUBLIC_GA_ID is set, so local and
 * preview builds stay out of the stats: set it for Vercel's Production
 * environment only. NEXT_PUBLIC_ values are inlined at build, and the pages are
 * prerendered, so a change needs a redeploy. next.config.ts reads this too, to
 * open the CSP to Google's analytics hosts only while it is on. */

/** The measurement ID ("G-…"), or null when analytics is off. */
export function gaId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim();
  // It is interpolated into an inline script, so accept only the real shape.
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

/** Hosts gtag.js loads from and reports to (Google's documented CSP list). */
export const GA_HOSTS = [
  "https://*.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
];

/** What counts as a button for the button_click event. */
const CONTROL =
  "button, a[href], [role=button], [role=menuitem], [role=menuitemradio], " +
  "[role=menuitemcheckbox], [role=radio], [role=tab], [role=switch], [role=option]";

/** The name a click on `target` is reported under, or null when it isn't on a
 * control. A data-track attribute (on the control or around it) wins; it is
 * required where the label holds the user's own data. Otherwise the control's
 * aria-label or text, with a trailing count dropped (the region nav's
 * "日本292" → "日本") so every button keeps one name. */
export function clickName(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(CONTROL);
  if (!control) return null;
  const tracked = control.closest("[data-track]")?.getAttribute("data-track");
  if (tracked) return tracked;
  const label = control.getAttribute("aria-label") || control.textContent || "";
  const name = label
    .replace(/\s+/g, " ")
    .replace(/\s*[\d–]+$/, "")
    .trim()
    .slice(0, 100);
  return name || null;
}
