import LZString from "lz-string";
import { describe, expect, it } from "vitest";
import { parseComic } from "./manhuagui";

/* Shaped like a manhuagui comic page: a start-reading link to the first
 * chapter, chapter lists in sections, and links to other comics. Made up
 * from the site's URL scheme; the live markup could not be fetched here. */
const PAGE = `
<div class="book-btn"><a href="/comic/28686/339522.html" class="btn-read">开始阅读</a></div>
<ul class="detail-list">
  <li class="status"><span><strong>漫画状态：</strong><span class="red">连载中</span>。
  最近于 [<span class="red">2026-10-01</span>] 更新至 [ <a href="/comic/28686/781203.html" target="_blank" class="blue">第125话</a> ]</span></li>
</ul>
<div class="chapter-list" id="chapter-list-0"><ul>
  <li><a href="/comic/28686/781203.html" title="第125话" class="status0" target="_blank"><span>第125话<i>23p</i></span></a></li>
  <li><a href="/comic/28686/779110.html" title="第124话" class="status0" target="_blank"><span>第124话<i>21p</i></span></a></li>
  <li><a href="/comic/28686/339522.html" title="第01话" class="status0" target="_blank"><span>第01话<i>40p</i></span></a></li>
</ul></div>
<div class="chapter-list" id="chapter-list-1"><ul>
  <li><a href="/comic/28686/790001.html" class="status0" target="_blank"><span>番外 &amp; 特别篇<i>8p</i></span></a></li>
</ul></div>
<a href="/comic/99999/999999.html">别的漫画</a>`;

describe("parseComic", () => {
  it("takes the chapter with the highest id, from any section", () => {
    expect(parseComic(PAGE, 28686)).toEqual({
      latestId: 790001,
      latest: "番外 & 特别篇",
      chapters: 6,
    });
  });

  it("prefers the title attribute", () => {
    const page = PAGE.replace(
      /<div class="chapter-list" id="chapter-list-1">[\s\S]*?<\/div>/,
      "",
    );
    expect(parseComic(page, 28686)).toMatchObject({
      latestId: 781203,
      latest: "第125话",
    });
  });

  it("reads the compressed chapter list of adult-flagged comics", () => {
    const list = `<ul><li><a href="/comic/5/1002.html" title="第2话"><span>第2话</span></a></li>
      <li><a href="/comic/5/1001.html" title="第1话"><span>第1话</span></a></li></ul>`;
    const page = `<div class="chapter-list"></div>
      <input type="hidden" id="__VIEWSTATE" value="${LZString.compressToBase64(list)}" />`;
    expect(parseComic(page, 5)).toEqual({
      latestId: 1002,
      latest: "第2话",
      chapters: 2,
    });
  });

  it("accepts absolute links", () => {
    const page = `<a href="https://tw.manhuagui.com/comic/5/77.html" title="第3话">x</a>`;
    expect(parseComic(page, 5)).toMatchObject({ latestId: 77 });
  });

  it("is null when there are no chapter links (a block page, say)", () => {
    expect(
      parseComic("<html><body>Access denied</body></html>", 28686),
    ).toBeNull();
    expect(parseComic(PAGE, 1)).toBeNull();
  });
});
