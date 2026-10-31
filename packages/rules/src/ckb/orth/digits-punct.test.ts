import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { digitsPunct } from "./digits-punct.js";

describe("ckb.orth.digits-punct", () => {
  ruleCases({
    rule: digitsPunct,
    lang: "ckb",
    lexicon: null,
    positive: [
      ["چۆنی?", "؟"],
      ["ساڵی 2015", "٢٠١٥"],
      ["من, تۆ", "،"],
      ["من; تۆ", "؛"],
      ["کتێب 5", "٥"],
      ["چۆنی? باشم", "؟"],
      ["ساڵی 1990 بوو", "١٩٩٠"],
      ["١٢ و 3", "٣"],
      ["ئەو, من, تۆ", "،"],
      ["ژمارە 42", "٤٢"],
    ],
    negative: [
      "چۆنی؟",
      "ساڵی ٢٠١٥",
      "من، تۆ",
      "من؛ تۆ",
      "کتێب ٥",
      "Tu çawa yî?",
      "Sala 2015",
      "a, b",
      "ژمارە ٤٢",
      "کتێب",
      "",
    ],
  });
});
