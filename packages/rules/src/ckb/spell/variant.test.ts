import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { knownVariant } from "./variant.js";

describe("ckb.spell.variant", () => {
  ruleCases({
    rule: knownVariant,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["بەلام", "بەڵام"],
      ["ڕای‌گەیاند", "ڕایگەیاند"],
      ["بەلام بەلام", "بەڵام"],
      ["سێشەمە", "سێشەممە"],
      ["دیناره", "دینارە"],
      ["نێردراوه", "نێردراوە"],
      ["من بەلام", "بەڵام"],
      ["بەلام من", "بەڵام"],
      ["وتی بەلام", "بەڵام"],
      ["هات بەلام نەچوو", "بەڵام"],
    ],
    negative: [
      "بەڵام",
      "ڕایگەیاند",
      "سێشەممە",
      "دینارە",
      "کتێب",
      "ماڵ",
      "هات بەڵام نەچوو",
      "من",
      "پیاو",
      "kitêb",
      "",
    ],
  });
});
