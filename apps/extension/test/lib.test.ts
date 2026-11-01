import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isCheckerRequest,
  lessonRoute,
  lexiconsFor,
  matchPatternOf,
  originOf,
  routeOfLessonLink,
  toBackground,
  toContent,
} from "../src/lib/messages";
import { pronounce, transliterate } from "../src/lib/writing";

describe("messages", () => {
  it("lets a page make checking requests, but not load a lexicon", () => {
    expect(isCheckerRequest({ type: "check" })).toBe(true);
    expect(isCheckerRequest({ type: "complete" })).toBe(true);
    expect(isCheckerRequest({ type: "load" })).toBe(false);
    expect(isCheckerRequest(null)).toBe(false);
    expect(isCheckerRequest("check")).toBe(false);
  });

  it("refuses anything but known requests", () => {
    expect(toBackground.safeParse({ kind: "open-app", route: "/check" }).success).toBe(true);
    expect(
      toBackground.safeParse({ kind: "open-lesson", lesson: { lang: "ckb", lessonId: 99, anchor: "" } })
        .success,
    ).toBe(false);
    expect(toBackground.safeParse({ kind: "steal" }).success).toBe(false);
    expect(toContent.safeParse({ kind: "status" }).success).toBe(true);
    expect(toContent.safeParse({ kind: "run", code: "x" }).success).toBe(false);
  });

  it("loads only the lexicons a request needs", () => {
    expect(lexiconsFor({ type: "suggest", lang: "kmr" })).toEqual(["kmr"]);
    expect(lexiconsFor({ type: "check", text: "x", options: { lang: "ckb" } })).toEqual(["ckb"]);
    expect(lexiconsFor({ type: "check", text: "Ez hatim" })).toEqual(["kmr"]);
    expect(lexiconsFor({ type: "check", text: "من هاتم" })).toEqual(["ckb"]);
    expect(lexiconsFor({ type: "check", text: "من and ez" })).toEqual(["ckb", "kmr"]);
    expect(lexiconsFor({ type: "check", text: "123" })).toEqual(["kmr"]);
    expect(lexiconsFor({ type: "check" })).toEqual([]);
  });

  it("makes routes for lessons", () => {
    expect(lessonRoute("ckb", 7, "the-bare-noun")).toBe("/learn/ckb/7/the-bare-noun");
    expect(lessonRoute("kmr", 14, "")).toBe("/learn/kmr/14");
  });

  it("runs only on ordinary web pages", () => {
    expect(originOf("https://a.example/x?y")).toBe("https://a.example");
    expect(originOf("chrome://settings")).toBeNull();
    expect(originOf("about:blank")).toBeNull();
    expect(originOf("not a url")).toBeNull();
    expect(originOf(undefined)).toBeNull();
  });

  it("makes permission patterns without ports", () => {
    expect(matchPatternOf("https://a.example")).toBe("https://a.example/*");
    expect(matchPatternOf("http://localhost:4176")).toBe("http://localhost/*");
  });
});

describe("links inside a lesson", () => {
  it("stay in the reader, keeping anchors", () => {
    expect(routeOfLessonLink("../14-past/#why", "kmr", 7)).toBe("/learn/kmr/14/why");
    expect(routeOfLessonLink("../../sorani/07-nouns/", "kmr", 7)).toBe("/learn/ckb/7");
  });

  it("go nowhere for pages the reader does not have", () => {
    expect(routeOfLessonLink("../../../rules/any.repeat.word/", "ckb", 7)).toBeNull();
    expect(routeOfLessonLink("../verbs/xwarin/", "kmr", 7)).toBeNull();
  });
});

describe("the other script and pronunciation", () => {
  it("takes Sorani to Latin, with its punctuation", () => {
    expect(transliterate("پیاوەکە هات؟")).toBe("pyaweke hat?");
  });

  it("takes Kurmanji to Arabic script", () => {
    expect(transliterate("Ez hatim")).toMatch(/\p{Script=Arabic}/u);
  });

  it("keeps what is between the words", () => {
    expect(transliterate("پیاو  (ژن)")).toBe("pyaw  (jin)");
  });

  it("gives the pronunciation in either script", () => {
    expect(pronounce("پیاو")).toBe("/pjaːw/");
    expect(pronounce("av")).toMatch(/^\/.+\/$/);
  });
});

describe("the store listing", () => {
  const listing = JSON.parse(
    readFileSync(new URL("../../../packages/content/marketing/store-listing.json", import.meta.url), "utf8"),
  ) as Record<string, { summary: string; features: string[]; permissions: Record<string, string> }>;
  const manifest = readFileSync(new URL("../wxt.config.ts", import.meta.url), "utf8");

  it.each(["en", "ckb", "kmr"])("%s fits the stores' limit, and justifies every permission", (lang) => {
    const entry = listing[lang] as (typeof listing)[string];
    expect(Array.from(entry.summary).length).toBeLessThanOrEqual(132);
    expect(entry.features.length).toBeGreaterThanOrEqual(3);
    for (const permission of ["storage", "activeTab", "scripting", "contextMenus", "sidePanel"]) {
      expect(manifest).toContain(`"${permission}"`);
      expect(entry.permissions[permission]).toBeTruthy();
    }
    expect(entry.permissions["optional host access"]).toBeTruthy();
  });
});
