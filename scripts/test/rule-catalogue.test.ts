import { describe, expect, it } from "vitest";
import { slug } from "../content/export-lesson-index.js";
import { main, render, validateMeta } from "../content/generate-rule-catalogue.js";

const lessons = { ckb: { "7": { title: "Nouns", anchors: ["counting"] } } };
const good = {
  id: "ckb.morph.example",
  category: "morphology",
  severity: "error",
  confidence: 0.9,
  safeFix: false,
  message: { en: "a", ckb: "b", kmr: "c" },
  reason: { en: "a", ckb: "b", kmr: "c" },
  examples: [{}, {}],
  lessons: [{ lang: "ckb", lessonId: 7, anchor: "counting" }],
};
const problems = (changes: object) => validateMeta({ ...good, ...changes }, "f", lessons);

describe("the rule catalogue", () => {
  it("accepts complete metadata", () => {
    expect(validateMeta(good, "f", lessons)).toEqual([]);
  });

  it.each<[string, object, string]>([
    ["a bad id", { id: "Not An Id" }, "bad id"],
    ["an id in no variety", { id: "xx.morph.example" }, "bad id"],
    ["an unknown category", { category: "vibes" }, "bad category"],
    ["an unknown severity", { severity: "fatal" }, "bad severity"],
    ["a confidence above 1", { confidence: 2 }, "bad confidence"],
    ["no confidence", { confidence: undefined }, "bad confidence"],
    ["a safeFix that is not true or false", { safeFix: "yes" }, "safeFix must be true or false"],
    ["a message missing a language", { message: { en: "a", ckb: "b" } }, "message needs kmr"],
    ["an empty message", { message: { en: "", ckb: "b", kmr: "c" } }, "message needs en"],
    ["a reason missing a language", { reason: { en: "a", kmr: "c" } }, "reason needs ckb"],
    ["one example", { examples: [{}] }, "at least two examples"],
    ["no examples", { examples: undefined }, "at least two examples"],
    ["no lesson link", { lessons: [] }, "needs a lesson link"],
    ["no lessons at all", { lessons: undefined }, "needs a lesson link"],
    ["a lesson that does not exist", { lessons: [{ lang: "ckb", lessonId: 99 }] }, "no lesson ckb 99"],
    ["a variety with no lessons", { lessons: [{ lang: "xx", lessonId: 1 }] }, "no lesson xx 1"],
    [
      "an anchor that does not exist",
      { lessons: [{ lang: "ckb", lessonId: 7, anchor: "nope" }] },
      "no anchor nope",
    ],
  ])("refuses %s", (_name, changes, expected) => {
    expect(problems(changes).join()).toContain(expected);
  });

  it("accepts a lesson link without an anchor", () => {
    expect(problems({ lessons: [{ lang: "ckb", lessonId: 7 }] })).toEqual([]);
  });

  it("compiles the real metadata, and the committed file is current", () => {
    expect(render()).toContain("any.repeat.word");
    expect(main(["--check"])).toBe(0);
  });
});

describe("heading anchors", () => {
  it.each([
    ["The big switch", "the-big-switch"],
    [
      "1. Use Kurdish letters, not Arabic or Persian ones",
      "1-use-kurdish-letters-not-arabic-or-persian-ones",
    ],
    ["2. Don't drop the marks", "2-dont-drop-the-marks"],
    ["3. Initial vowels need ئ", "3-initial-vowels-need-ئ"],
    ["  Spaces  here ", "spaces--here"],
  ])("%s becomes %s", (heading, anchor) => {
    expect(slug(heading)).toBe(anchor);
  });
});
