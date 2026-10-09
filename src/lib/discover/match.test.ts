import { describe, expect, it } from "vitest";
import { emptyLibrary, normalise, type Item, type Library } from "../schema";
import { libraryLookup, normTitle } from "./match";
import { regionOf, workKey, type Work } from "./types";

const work = (over: Partial<Work> = {}): Work => ({
  key: "anilist:anime:1",
  title: "葬送のフリーレン",
  subtitle: "",
  titles: ["葬送のフリーレン", "Sousou no Frieren"],
  url: "https://anilist.co/anime/1",
  image: null,
  color: null,
  category: "动画",
  region: "日本",
  phase: "releasing",
  format: "TV",
  date: null,
  total: null,
  score: null,
  next: null,
  ...over,
});

function library(items: Partial<Item>[]): Library {
  return { ...emptyLibrary(), 日本: normalise({ items }, "日本") };
}

describe("workKey", () => {
  it("recognises AniList and TMDB pages", () => {
    expect(workKey("https://anilist.co/anime/154587/Sousou-no-Frieren/")).toBe(
      "anilist:anime:154587",
    );
    expect(workKey("http://www.anilist.co/manga/30013")).toBe(
      "anilist:manga:30013",
    );
    expect(
      workKey(
        "https://www.themoviedb.org/movie/129-spirited-away?language=zh-CN",
      ),
    ).toBe("tmdb:movie:129");
    expect(workKey("https://themoviedb.org/movie/129")).toBe("tmdb:movie:129");
  });

  it("ignores other links", () => {
    expect(workKey("")).toBeNull();
    expect(workKey("https://www.manhuagui.com/comic/45263/")).toBeNull();
    expect(workKey("https://anilist.co/anime/12x")).toBeNull();
    expect(workKey("https://anilist.co.evil.com/anime/1")).toBeNull();
    expect(workKey("https://www.themoviedb.org/tv/1399")).toBeNull();
  });
});

describe("regionOf", () => {
  it("maps countries to the library's regions", () => {
    expect(regionOf("JP")).toBe("日本");
    expect(regionOf("TW")).toBe("中国");
    expect(regionOf("kr")).toBe("韩国");
    expect(regionOf("US")).toBe("欧美");
    expect(regionOf(null)).toBe("欧美");
  });
});

describe("libraryLookup", () => {
  it("matches by link first, whatever the item is called now", () => {
    const lib = library([
      {
        name: "芙莉莲",
        category: "动画",
        url: "https://anilist.co/anime/1/Sousou-no-Frieren",
      },
    ]);
    expect(libraryLookup(lib)(work())).toMatchObject({
      region: "日本",
      item: { name: "芙莉莲" },
    });
  });

  it("falls back to any title, ignoring case, width and punctuation", () => {
    const lib = library([{ name: "SOUSOU  NO  FRIEREN!", category: "动画" }]);
    expect(libraryLookup(lib)(work())?.item.name).toBe("SOUSOU  NO  FRIEREN!");
  });

  it("does not match a name across categories", () => {
    const lib = library([{ name: "Sousou no Frieren", category: "漫画" }]);
    expect(libraryLookup(lib)(work())).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(libraryLookup(emptyLibrary())(work())).toBeNull();
  });
});

describe("normTitle", () => {
  it("drops punctuation and full-width differences", () => {
    expect(normTitle("Re：从零开始的异世界生活")).toBe(
      normTitle("re 从零开始的异世界生活"),
    );
    expect(normTitle("【我推的孩子】")).toBe("我推的孩子");
  });
});
