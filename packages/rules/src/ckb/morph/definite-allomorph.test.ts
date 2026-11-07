import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { definiteAllomorph } from "./definite-allomorph.js";

describe("ckb.morph.definite-allomorph", () => {
  ruleCases({
    rule: definiteAllomorph,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["دەرگاەکە", "دەرگاکە"],
      ["دەرگاەکان", "دەرگاکان"],
      ["پیاوکە", "پیاوەکە"],
      ["پیاوکان", "پیاوەکان"],
      ["ماسیەکە", "ماسییەکە"],
      ["دەرگاەکەم", "دەرگاکەم"],
      ["نانکە", "نانەکە"],
      ["کتێبکان", "کتێبەکان"],
      ["چیاەکە", "چیاکە"],
      ["من دەرگاەکە دەبینم", "دەرگاکە"],
    ],
    negative: [
      "دەرگاکە",
      "پیاوەکە",
      "دەرگاکان",
      "پیاوەکان",
      "ماسییەکە",
      "نانەکە",
      "کتێبەکەم",
      "کە",
      "دەکە",
      "بەرکە",
      "kitêb",
      "",
    ],
  });
});
