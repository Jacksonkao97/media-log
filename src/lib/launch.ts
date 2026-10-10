/* What the app was launched to do, from its URL:
 *   /?new=1                     the 新增作品 home-screen shortcut
 *   /?title=…&text=…&url=…      something shared to the app (Android share sheet)
 * Returns the fields to pre-fill a new item with, or null for a plain launch. */

import type { ItemFields } from "./schema";

/** The parameters a launch URL may carry. Other ones, such as utm_source on a
 * link to the site, are left in the address for analytics to see. */
const LAUNCH_PARAMS = ["new", "title", "text", "url"];

/** Whether the URL is a launch, whose query MediaLog reads and then strips.
 * It carries the user's own text, so analytics waits until it is gone. */
export const isLaunch = (params: URLSearchParams) =>
  LAUNCH_PARAMS.some((p) => params.has(p));

export function launchDraft(
  params: URLSearchParams,
): Partial<ItemFields> | null {
  const title = params.get("title")?.trim() ?? "";
  const text = params.get("text")?.trim() ?? "";
  const url = params.get("url")?.trim() ?? "";

  if (!title && !text && !url) return params.get("new") === "1" ? {} : null;

  // Many Android apps put the link in `text` rather than `url`.
  const link = url || text.match(/https?:\/\/\S+/)?.[0] || "";
  const name = title || text.replace(link, "").trim();
  return { name, url: /^https?:\/\//i.test(link) ? link : "" };
}
