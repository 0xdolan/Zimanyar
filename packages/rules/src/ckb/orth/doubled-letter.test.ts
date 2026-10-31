import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { doubledLetter } from "./doubled-letter.js";

describe("ckb.orth.doubled-letter", () => {
  ruleCases({
    rule: doubledLetter,
    lang: "ckb",
    lexicon: null,
    positive: [
      ["مەەر", "مەر"],
      ["بووو", "بوو"],
      ["ڕڕۆژ", "ڕۆژ"],
      ["گوڵڵ", "گوڵ"],
      ["زۆررڕ", "زۆرڕ"],
      ["ئئاو", "ئاو"],
      ["کەەس", "کەس"],
      ["هەەر", "هەر"],
      ["نوووسین", "نووسین"],
      ["دیییی", "دیی"],
    ],
    negative: ["مەر", "بوو", "ڕۆژ", "گوڵ", "ئاو", "کەس", "نووسین", "ماسیی", "شەممە", "kurrd", ""],
  });
});
