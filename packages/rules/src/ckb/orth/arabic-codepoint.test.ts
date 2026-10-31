import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { arabicCodepoint } from "./arabic-codepoint.js";

describe("ckb.orth.arabic-codepoint", () => {
  ruleCases({
    rule: arabicCodepoint,
    lang: "ckb",
    lexicon: null,
    positive: [
      ["كتێب", "کتێب"],
      ["ماسي", "ماسی"],
      ["كورد", "کورد"],
      ["هةر", "هەر"],
      ["ھەموو", "هەموو"],
      ["چاى", "چای"],
      ["كوردي", "کوردی"],
      ["خانۀ", "خانەی"],
      ["من كتێب دەخوێنم.", "کتێب"],
      ["ئەو كچە", "کچە"],
    ],
    negative: [
      "کتێب",
      "ماسی",
      "کورد",
      "هەر",
      "هەموو",
      "چای",
      "کوردی",
      "من کتێب دەخوێنم.",
      "ئەو کچە",
      "kitêb",
      "",
    ],
  });
});
