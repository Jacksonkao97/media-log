import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  VIEW_PATHS,
  parseView,
  viewPath,
  viewTitle,
} from "./view";

describe("view paths", () => {
  it("gives every region and feed its own path, 日本 at /", () => {
    expect(VIEW_PATHS).toEqual([
      "/",
      "/cn",
      "/kr",
      "/west",
      "/discover/airing",
      "/discover/season",
      "/discover/manga",
      "/discover/movies",
    ]);
  });

  it("names only the part of the view that is showing", () => {
    expect(viewPath({ ...DEFAULT_VIEW, region: "韩国" })).toBe("/kr");
    expect(
      viewPath({ section: "discover", region: "韩国", feed: "season" }),
    ).toBe("/discover/season");
  });

  it("reads every path back", () => {
    for (const path of VIEW_PATHS) {
      const shown = parseView(path)!;
      expect(viewPath({ ...DEFAULT_VIEW, ...shown })).toBe(path);
    }
    expect(parseView("/west")).toEqual({ section: "library", region: "欧美" });
    expect(parseView("/discover/manga")).toEqual({
      section: "discover",
      feed: "manga",
    });
  });

  it("titles each view by its region or feed", () => {
    expect(viewTitle(DEFAULT_VIEW)).toBe("日本 · MediaLog");
    expect(
      viewTitle({ section: "discover", region: "韩国", feed: "season" }),
    ).toBe("季度新番 · MediaLog");
  });

  it("rejects anything else", () => {
    for (const path of ["/jp", "/discover", "/discover/x", "/cn/x", "/a/b/c"])
      expect(parseView(path)).toBeNull();
  });
});
