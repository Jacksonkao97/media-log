/* What the app was launched to do, from its URL:
 *   /?new=1                     the 新增作品 home-screen shortcut
 *   /?title=…&text=…&url=…      something shared to the app (Android share sheet)
 * Returns the fields to pre-fill a new item with, or null for a plain launch. */

import type { ItemFields } from "./schema";

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
