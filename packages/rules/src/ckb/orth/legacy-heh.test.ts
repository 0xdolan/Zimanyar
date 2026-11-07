import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { legacyHeh } from "./legacy-heh.js";

describe("ckb.orth.legacy-heh", () => {
  ruleCases({
    rule: legacyHeh,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["به‌ڕێوه‌به‌ر", "بەڕێوەبەر"],
      ["وێستگه", "وێستگە"],
      ["سێشەممه", "سێشەممە"],
      ["که‌س", "کەس"],
      ["هه‌موو", "هەموو"],
      ["مه‌ر", "مەر"],
      ["به‌ڵام", "بەڵام"],
      ["ئه‌و", "ئەو"],
      ["پیاوه‌که‌", "پیاوەکە"],
      ["نێردراوه", "نێردراوە"],
    ],
    negative: ["بەڕێوەبەر", "وێستگە", "کەس", "هەموو", "ئەو", "شاه", "ده", "ماه", "گوڵ", "هەر", "kitêb", ""],
  });
});
