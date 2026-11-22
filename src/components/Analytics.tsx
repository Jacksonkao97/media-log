"use client";

/* Google Analytics (lib/analytics.ts): page views, visits and button clicks.
 * gtag.js and its snippet are in every page's HTML (layout.tsx, gaSnippet);
 * this adds what needs the app.
 *
 *   - Page views and visits (sessions) are GA4's own. The first page_view is
 *     the snippet's `config`; the view switches after it are pushState, which
 *     GA4's enhanced measurement ("page changes based on browser history
 *     events", on by default) counts as page views.
 *   - Where visitors come from is GA4's own too: the referrer, and campaign
 *     tags (?utm_source=…), which MediaLog leaves in the address.
 *   - A launch URL (isLaunch) carries the user's own text: a page shared to
 *     the app arrives as /?title=…&url=…, which MediaLog turns into a draft
 *     and then strips. The snippet skips `config` then, and this sends it once
 *     the query is gone, so the first page_view never holds that text.
 *   - Clicks: one listener sends a button_click event, with button_name,
 *     for every button, link, menu item, tab or toggle (clickName). The name
 *     is the control's static label. Controls whose label holds the user's
 *     own data (an item's name in the list) set data-track to a fixed name
 *     instead; nothing from the library may reach GA. An English label is
 *     sent as the Chinese one it translates (zhName), so each button keeps
 *     one name whichever language it was clicked in. */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { clickName } from "@/lib/analytics";
import { zhName } from "@/lib/i18n";
import { isLaunch } from "@/lib/launch";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

export function Analytics({ id }: { id: string }) {
  const ready = !isLaunch(useSearchParams());
  useEffect(() => {
    const { gtag, dataLayer = [] } = window;
    if (!ready || !gtag) return;
    // The snippet skipped config on a launch URL; send it now it is stripped.
    if (!dataLayer.some((a) => a[0] === "config")) gtag("config", id);
    // Capture phase: Radix menus stop propagation of some clicks.
    const onClick = (e: MouseEvent) => {
      const name = clickName(e.target);
      // English labels are reported in Chinese, so stats don't split by language.
      if (name) gtag("event", "button_click", { button_name: zhName(name) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [ready, id]);
  return null;
}
