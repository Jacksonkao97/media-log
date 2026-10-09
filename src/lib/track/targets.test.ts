import { describe, expect, it } from "vitest";
import { emptyLibrary, normalise, type Item } from "../schema";
import { cleanFollows, followsOf, targetOf, targetUrl } from "./targets";

const item = (over: Partial<Item>): Item =>
  normalise({ items: [{ watch: "看着", ...over }] }, "日本").items[0];

describe("targetOf", () => {
  it("follows 看着 anime linked to AniList", () => {
    expect(
      targetOf(
        item({
          category: "动画",
          url: "https://anilist.co/anime/154587/Frieren/",
        }),
      ),
    ).toBe("anilist:154587");
  });

  it("follows 看着 manga on any manhuagui host", () => {
    for (const url of [
      "https://www.manhuagui.com/comic/28686/",
      "https://tw.manhuagui.com/comic/28686",
      "http://m.manhuagui.com/comic/28686/?from=x",
      "https://manhuagui.com/comic/28686/",
    ])
      expect(targetOf(item({ category: "漫画", url }))).toBe("manhuagui:28686");
  });

  it("ignores anything else", () => {
    expect(
      targetOf(
        item({
          category: "漫画",
          url: "https://www.manhuagui.com/comic/1/",
          watch: "未看",
        }),
      ),
    ).toBeNull();
    expect(
      targetOf(
        item({
          category: "漫画",
          url: "https://www.manhuagui.com/comic/1/",
          watch: "看完了",
        }),
      ),
    ).toBeNull();
    expect(
      targetOf(item({ category: "电影", url: "https://anilist.co/anime/1" })),
    ).toBeNull();
    expect(
      targetOf(item({ category: "漫画", url: "https://anilist.co/manga/1" })),
    ).toBeNull();
    expect(
      targetOf(
        item({ category: "动画", url: "https://www.manhuagui.com/comic/1/" }),
      ),
    ).toBeNull();
    expect(
      targetOf(
        item({ category: "漫画", url: "https://www.baozimh.com/comic/x" }),
      ),
    ).toBeNull();
    expect(
      targetOf(
        item({ category: "漫画", url: "https://evilmanhuagui.com/comic/1/" }),
      ),
    ).toBeNull();
  });
});

describe("followsOf", () => {
  it("lists each followed target once, across regions", () => {
    const lib = emptyLibrary();
    lib.日本 = normalise(
      {
        items: [
          {
            id: "a",
            name: "A",
            category: "漫画",
            watch: "看着",
            progress: "12",
            url: "https://www.manhuagui.com/comic/1/",
          },
          {
            id: "b",
            name: "B",
            category: "漫画",
            watch: "看着",
            url: "https://tw.manhuagui.com/comic/1/",
          },
          {
            id: "c",
            name: "C",
            category: "漫画",
            watch: "未看",
            url: "https://www.manhuagui.com/comic/2/",
          },
        ],
      },
      "日本",
    );
    lib.中国 = normalise(
      {
        items: [
          {
            id: "d",
            name: "D",
            category: "动画",
            watch: "看着",
            url: "https://anilist.co/anime/9",
          },
        ],
      },
      "中国",
    );
    expect(followsOf(lib)).toEqual([
      { id: "a", name: "A", target: "manhuagui:1", progress: "12" },
      { id: "d", name: "D", target: "anilist:9", progress: "" },
    ]);
  });
});

describe("cleanFollows", () => {
  it("keeps well-formed follows, trimmed and de-duplicated", () => {
    expect(
      cleanFollows([
        {
          id: "a",
          name: "x".repeat(300),
          target: "manhuagui:1",
          progress: "3",
        },
        { id: "b", name: "dup", target: "manhuagui:1" },
        { id: "c", target: "anilist:2" },
        { target: "manhuagui:0" },
        { target: "http://169.254.169.254/" },
        { target: "anilist:1e3" },
        null,
        "junk",
      ]),
    ).toEqual([
      { id: "a", name: "x".repeat(120), target: "manhuagui:1", progress: "3" },
      { id: "c", name: "anilist:2", target: "anilist:2", progress: "" },
    ]);
    expect(cleanFollows({ not: "a list" })).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      target: `anilist:${i + 1}`,
    }));
    expect(cleanFollows(many)).toHaveLength(500);
  });
});

describe("targetUrl", () => {
  it("opens the comic for manga and the app for anime", () => {
    expect(targetUrl("manhuagui:28686")).toBe(
      "https://www.manhuagui.com/comic/28686/",
    );
    expect(targetUrl("anilist:1")).toBe("/");
  });
});
