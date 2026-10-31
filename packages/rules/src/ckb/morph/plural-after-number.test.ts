import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { pluralAfterNumber } from "./plural-after-number.js";

describe("ckb.morph.plural-after-number", () => {
  ruleCases({
    rule: pluralAfterNumber,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["سێ پیاوان", "پیاو"],
      ["دوو کتێبان", "کتێب"],
      ["چوار نانان", "نان"],
      ["پێنج کوڕان", "کوڕ"],
      ["شەش ماڵان", "ماڵ"],
      ["دە کچان", "کچ"],
      ["سەد پیاوان", "پیاو"],
      ["هەزار کتێبان", "کتێب"],
      ["من سێ پیاوان دەبینم", "پیاو"],
      ["حەوت ژنان", "ژن"],
    ],
    negative: [
      "سێ پیاو",
      "دوو کتێب",
      "سێ پیاوەکان",
      "دوو کتێبەکان",
      "پیاوان",
      "سێ، پیاوان",
      "سێ ژیان",
      "من پیاوان دەبینم",
      "دوو",
      "kitêb",
      "دە ماڵ",
    ],
  });
});
