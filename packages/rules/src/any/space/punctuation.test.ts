import { describe, expect, it } from "vitest";
import { ruleCases, runOne } from "../../../test/helpers.js";
import { spacePunctuation } from "./punctuation.js";

describe("any.space.punctuation", () => {
  ruleCases({
    rule: spacePunctuation,
    lang: "kmr",
    positive: [
      ["Ez hatim .", "."],
      ["Ez hatim ,", ","],
      ["Ez hatim !", "!"],
      ["Tu hatî ?", "?"],
      ["Ez  hatim", " "],
      ["Ez   hatim", " "],
      ["Ez,tu", ", "],
      ["Ez!tu", "! "],
      ["هات ،", "،"],
      ["هات ؟", "؟"],
      ["هات،ڕۆیشت", "، "],
      ["هات؟ڕۆیشت", "؟ "],
    ],
    negative: [
      "Ez hatim.",
      "Ez, tu, ew.",
      "3.5 kg",
      "3,5",
      "1 000 000",
      "www.example.org",
      "a@b.c",
      "HDP'ê",
      "Bi rastî...",
      "Na ... na.",
      "  destpêk",
      "dawî  ",
      "من هاتم، ئەو ڕۆیشت.",
      ". destpêk",
    ],
  });

  it("is a deterministic fix", () => {
    expect(runOne(spacePunctuation, "Ez hatim .", "kmr")[0]?.safeFix).toBe(true);
  });
});
