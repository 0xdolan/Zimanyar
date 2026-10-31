import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { initialVowel } from "./initial-vowel.js";

describe("ckb.orth.initial-vowel", () => {
  ruleCases({
    rule: initialVowel,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["اسپ", "ئەسپ"],
      ["او", "ئاو"],
      ["ێمە", "ئێمە"],
      ["ەو", "ئەو"],
      ["ۆف", "ئۆف"],
      ["ارام", "ئارام"],
      ["من او دەخۆم", "ئاو"],
      ["اشکرا", "ئاشکرا"],
      ["ەمڕۆ", "ئەمڕۆ"],
      ["اسان", "ئاسان"],
    ],
    negative: ["ئەسپ", "ئاو", "ئێمە", "ئەو", "کتێب", "ئا", "ا", "ە", "و", "من ئاو دەخۆم", "هاتم", ""],
  });
});
