import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { unknownWord } from "./unknown.js";

describe("ckb.spell.unknown", () => {
  ruleCases({
    rule: unknownWord,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["کتیب", "کتێب"],
      ["پیاف", "پیاو"],
      ["قخقخقخ"],
      ["زززز"],
      ["ماڵێکس"],
      ["دەرگوا", "دەرگا"],
      ["نانبوو"],
      ["من کتیب دەخوێنم", "کتێب"],
      ["قفقف"],
      ["ژژژژژ"],
    ],
    negative: [
      "هەڵیدەگرم",
      "دەمبینیت",
      "کتێبەکە لەسەر مێزەکەیە",
      "کتێب",
      "پیاو",
      "ماڵ",
      "دەرگاکە",
      "پیاوەکە",
      "کتێبەکەم",
      "دەکەم",
      "من",
      "و",
      "kitêb",
      "12",
      "",
    ],
  });
});
