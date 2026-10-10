"use client";

/* Loads Google Analytics (lib/analytics.ts) once the address has no query.
 * Launch URLs carry the user's own text: a page shared to the app arrives as
 * /?title=…&url=…, which MediaLog turns into a draft and then strips. gtag's
 * first page_view reports the full address, so it waits for that. The view
 * switches after it (pushState) never have a query, and GA4's enhanced
 * measurement counts them as page views by itself. */

import { useSearchParams } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";

export function Analytics({ id }: { id: string }) {
  // next/script runs each script once per page load, even if this remounts.
  return useSearchParams().size === 0 ? <GoogleAnalytics gaId={id} /> : null;
}
