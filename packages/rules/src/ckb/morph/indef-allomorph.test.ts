import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { indefiniteAllomorph } from "./indef-allomorph.js";

describe("ckb.morph.indef-allomorph", () => {
  ruleCases({
    rule: indefiniteAllomorph,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["دەرگاێک", "دەرگایەک"],
      ["پیاویەک", "پیاوێک"],
      ["نانیەک", "نانێک"],
      ["چیاێک", "چیایەک"],
      ["کتێبیەک", "کتێبێک"],
      ["دەرگاێکی", "دەرگایەکی"],
      ["پیاویەکی", "پیاوێکی"],
      ["ماڵیەک", "ماڵێک"],
      ["کوڕیەک", "کوڕێک"],
      ["من دەرگاێک دەبینم", "دەرگایەک"],
    ],
    negative: [
      "دەرگایەک",
      "پیاوێک",
      "نانێک",
      "چیایەک",
      "کتێبێک",
      "دەرگایەکی",
      "یەک",
      "هەندێک",
      "ئەوێک",
      "kitêbek",
      "",
    ],
  });
});
