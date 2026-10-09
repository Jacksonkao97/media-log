/* Which part of the app is showing, and its URL. Each view is its own
 * prerendered page (src/app/[[...view]]/page.tsx), so a reload paints the
 * right region or feed at once. Switching views inside the app only pushes
 * the URL; it doesn't load a page. */

import { FEED_IDS, type FeedId } from "./discover/feeds";
import { REGIONS, type Region } from "./schema";

export type Section = "library" | "discover";

/** The section showing, plus the region and feed each section returns to. */
export interface View {
  section: Section;
  region: Region;
  feed: FeedId;
}

export const DEFAULT_VIEW: View = {
  section: "library",
  region: REGIONS[0],
  feed: FEED_IDS[0],
};

/** 日本 is the home page. */
const REGION_SLUG: Record<Region, string> = {
  日本: "",
  中国: "cn",
  韩国: "kr",
  欧美: "west",
};

export function viewPath(v: View): string {
  return v.section === "discover"
    ? `/discover/${v.feed}`
    : `/${REGION_SLUG[v.region]}`;
}

/** Every view's path: what gets prerendered and precached. */
export const VIEW_PATHS: string[] = [
  ...REGIONS.map((region) => viewPath({ ...DEFAULT_VIEW, region })),
  ...FEED_IDS.map((feed) =>
    viewPath({ ...DEFAULT_VIEW, section: "discover", feed }),
  ),
];

/** The view a path shows, or null for any other path. Only the part the
 *  path names is set: a feed page says nothing about the region. */
export function parseView(
  path: string,
): Pick<View, "section" | "region"> | Pick<View, "section" | "feed"> | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "discover") {
    const feed = FEED_IDS.find((f) => f === parts[1]);
    return feed ? { section: "discover", feed } : null;
  }
  if (parts.length > 1) return null;
  const region = REGIONS.find((r) => REGION_SLUG[r] === (parts[0] ?? ""));
  return region ? { section: "library", region } : null;
}
