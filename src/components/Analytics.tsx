"use client";

/* Google Analytics (lib/analytics.ts): page views, visits and button clicks.
 *
 *   - Page views and visits (sessions) are GA4's own. The first page_view is
 *     sent when gtag loads; the view switches after it are pushState, which
 *     GA4's enhanced measurement ("page changes based on browser history
 *     events", on by default) counts as page views.
 *   - Where visitors come from is GA4's own too: the referrer, and campaign
 *     tags (?utm_source=…), which MediaLog leaves in the address.
 *   - The tag waits while the address is a launch URL (isLaunch). Those carry
 *     the user's own text: a page shared to the app arrives as
 *     /?title=…&url=…, which MediaLog turns into a draft and then strips, and
 *     gtag's first page_view reports the full address.
 *   - Clicks: one listener sends a button_click event, with button_name,
 *     for every button, link, menu item, tab or toggle (clickName). The name
 *     is the control's static label. Controls whose label holds the user's
 *     own data (an item's name in the list) set data-track to a fixed name
 *     instead; nothing from the library may reach GA. */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { clickName } from "@/lib/analytics";
import { isLaunch } from "@/lib/launch";

export function Analytics({ id }: { id: string }) {
  const ready = !isLaunch(useSearchParams());
  useEffect(() => {
    if (!ready) return;
    // Capture phase: Radix menus stop propagation of some clicks.
    const onClick = (e: MouseEvent) => {
      const name = clickName(e.target);
      if (name) sendGAEvent("event", "button_click", { button_name: name });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [ready]);
  // next/script runs each script once per page load, even if this remounts.
  return ready ? <GoogleAnalytics gaId={id} /> : null;
}
