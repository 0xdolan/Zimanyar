import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { missingMark } from "./missing-mark.js";

describe("ckb.spell.missing-mark", () => {
  ruleCases({
    rule: missingMark,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["گول", "گوڵ"],
      ["من گول دەبینم", "گوڵ"],
      ["مال", "ماڵ"],
      ["گول و مال", "گوڵ"],
      ["دیر", "دێر"],
      ["کور", "کوڕ"],
      ["گول نوێ", "گوڵ"],
      ["گول هات", "گوڵ"],
      ["تو", "تۆ"],
      ["هەرەس", "هەڕەس"],
    ],
    negative: ["گوڵ", "ماڵ", "دێر", "کوڕ", "کتێب", "پیاو", "تۆ", "نان", "سوور", "kitêb", ""],
  });
});
