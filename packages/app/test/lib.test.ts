import { describe, expect, it } from "vitest";
import { lessonRoute, routeOfLessonLink } from "../src/routes";
import { pronounce, transliterate } from "../src/writing";

describe("routes", () => {
  it("makes routes for lessons", () => {
    expect(lessonRoute("ckb", 7, "the-bare-noun")).toBe("/learn/ckb/7/the-bare-noun");
    expect(lessonRoute("kmr", 14, "")).toBe("/learn/kmr/14");
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
