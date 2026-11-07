import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
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
      ["گوڵڵڵ", "گوڵڵ"],
      ["ڕۆژڕڕ", "ڕۆژڕ"],
      ["ئئاو", "ئاو"],
      ["کەەس", "کەس"],
      ["هەەر", "هەر"],
      ["نوووسین", "نووسین"],
      ["دیییی", "دییی"],
    ],
    negative: [
      "ئەڵڵا",
      "سنەییی",
      "زۆرڕ",
      "مەر",
      "بوو",
      "ڕۆژ",
      "گوڵ",
      "ئاو",
      "کەس",
      "نووسین",
      "ماسیی",
      "شەممە",
      "kurrd",
      "",
    ],
  });
});
