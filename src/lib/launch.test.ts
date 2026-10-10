import { describe, expect, it } from "vitest";
import { isLaunch, launchDraft } from "./launch";

const q = (s: string) => launchDraft(new URLSearchParams(s));

describe("launchDraft", () => {
  it("is null for a plain launch", () => {
    expect(q("")).toBeNull();
    expect(q("utm_source=homescreen")).toBeNull();
  });

  it("opens an empty editor for the 新增 shortcut", () => {
    expect(q("new=1")).toEqual({});
  });

  it("takes title and url from a share", () => {
    expect(q("title=全知读者视角&url=https://example.com/comic/1")).toEqual({
      name: "全知读者视角",
      url: "https://example.com/comic/1",
    });
  });

  it("finds the link inside text when url is empty", () => {
    expect(
      q("text=" + encodeURIComponent("我独自升级 https://example.com/x")),
    ).toEqual({
      name: "我独自升级",
      url: "https://example.com/x",
    });
  });

  it("drops a link that is not http(s)", () => {
    expect(q("title=x&url=javascript:alert(1)")).toEqual({
      name: "x",
      url: "",
    });
  });
});

describe("isLaunch", () => {
  const is = (s: string) => isLaunch(new URLSearchParams(s));

  it("is true for the shortcut and for shares", () => {
    expect(is("new=1")).toBe(true);
    expect(is("title=x&url=https://example.com")).toBe(true);
    expect(is("text=x")).toBe(true);
  });

  it("is false for no query and for campaign tags", () => {
    expect(is("")).toBe(false);
    expect(is("utm_source=twitter&utm_medium=social")).toBe(false);
  });
});
