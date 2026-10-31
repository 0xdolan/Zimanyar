import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { initialR } from "./initial-r.js";

describe("ckb.orth.initial-r", () => {
  ruleCases({
    rule: initialR,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["رۆژ", "ڕۆژ"],
      ["ئەو رۆژە", "ڕۆژە"],
      ["رووبار", "ڕووبار"],
      ["رەش", "ڕەش"],
      ["ریز", "ڕیز"],
      ["رۆیشت", "ڕۆیشت"],
      ["راست", "ڕاست"],
      ["روو", "ڕوو"],
      ["رەنگ", "ڕەنگ"],
      ["رێگا", "ڕێگا"],
    ],
    negative: ["ڕۆژ", "ئەو ڕۆژە", "کورد", "مار", "هەر", "بەرز", "دەریا", "ڕەش", "rê", ""],
  });
});
