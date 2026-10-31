import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { ezafeMissing } from "./ezafe-missing.js";

describe("ckb.morph.ezafe-missing", () => {
  ruleCases({
    rule: ezafeMissing,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["پیاو باش", "پیاوی"],
      ["کتێب نوێ", "کتێبی"],
      ["ژن جوان", "ژنی"],
      ["ماڵ گەورە", "ماڵی"],
      ["کوڕ بچووک", "کوڕی"],
      ["نان باش", "نانی"],
      ["کچ جوان", "کچی"],
      ["پیاو گەورە", "پیاوی"],
      ["ماڵ کۆن", "ماڵی"],
      ["دەرگا نوێ", "دەرگای"],
      ["کتێب کۆن", "کتێبی"],
    ],
    negative: [
      "پیاوی باش",
      "کتێبی نوێ",
      "پیاو باش دەخوێنێت",
      "کوڕ جوان دەنووسێت",
      "پیاوەکە باش",
      "باش پیاو",
      "پیاو هات",
      "پیاو، باش",
      "ماڵ کتێب",
      "باش جوان",
      "kitêb",
    ],
  });
});
