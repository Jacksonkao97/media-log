/* manhuagui (漫画柜) comic pages: the newest chapter.
 *
 * Rather than parse the 「更新至」 status line, whose markup isn't documented,
 * this reads every chapter link on the page (/comic/<comic>/<chapter>.html)
 * and takes the one with the highest chapter id: ids are assigned as
 * chapters are uploaded, so a new chapter always has a higher one. Comics the
 * site flags as adult keep the chapter list LZString-compressed in a hidden
 * __VIEWSTATE field instead, which is decoded first. */

import LZString from "lz-string";

export interface Comic {
  /** The newest chapter's id: what the tracker compares. */
  latestId: number;
  /** Its title, e.g. "第120话". */
  latest: string;
  /** How many chapter links the page had. */
  chapters: number;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};
const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]);

/** The link's title attribute, else its text without the page count
 *  (<i>21p</i>) and tags. */
function chapterTitle(tag: string, inner: string): string {
  const title = tag.match(/\btitle="([^"]*)"/i)?.[1];
  if (title?.trim()) return decode(title.trim());
  return decode(
    inner
      .replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim(),
  );
}

export function parseComic(html: string, comicId: number): Comic | null {
  let source = html;
  const state =
    html.match(/id="__VIEWSTATE"[^>]*\bvalue="([^"]+)"/i) ??
    html.match(/\bvalue="([^"]+)"[^>]*id="__VIEWSTATE"/i);
  if (state) source += LZString.decompressFromBase64(state[1]) ?? "";

  const link = new RegExp(
    `<a\\b[^>]*\\bhref="(?:https?://[^"/]*)?/comic/${comicId}/(\\d+)\\.html"[^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );
  let best: { id: number; tag: string; inner: string } | null = null;
  let chapters = 0;
  for (const m of source.matchAll(link)) {
    chapters++;
    const id = Number(m[1]);
    if (!best || id > best.id) best = { id, tag: m[0], inner: m[2] };
  }
  if (!best) return null;
  return {
    latestId: best.id,
    latest: chapterTitle(best.tag, best.inner) || `#${best.id}`,
    chapters,
  };
}

/** MANHUAGUI_ORIGIN, e.g. https://tw.manhuagui.com if www is blocked where
 *  the server runs. */
const origin = () =>
  (process.env.MANHUAGUI_ORIGIN?.trim() || "https://www.manhuagui.com").replace(
    /\/+$/,
    "",
  );

export async function fetchComic(id: number): Promise<Comic> {
  const url = `${origin()}/comic/${id}/`;
  const res = await fetch(url, {
    headers: {
      // The site serves bots a different (or no) page.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: `${origin()}/`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`漫画柜返回 ${res.status}`);
  const comic = parseComic(await res.text(), id);
  if (!comic) throw new Error("页面里找不到章节列表");
  return comic;
}
