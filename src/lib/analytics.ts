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
