import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { verbFinal } from "./verb-final.js";

describe("ckb.syntax.verb-final", () => {
  ruleCases({
    rule: verbFinal,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["دەمخوارد نان", "نانم دەخوارد"],
      ["خواردم نان", "نانم خوارد"],
      ["دەتخوارد نان", "نانت دەخوارد"],
      ["خواردت نان", "نانت خوارد"],
      ["دەمانخوارد نان", "نانمان دەخوارد"],
      ["خواردمان نان", "نانمان خوارد"],
      ["کڕیم کتێب", "کتێبم کڕی"],
      ["بردم نان", "نانم برد"],
      ["من خواردم نان", "نانم خوارد"],
      ["دەمکڕی کتێب", "کتێبم دەکڕی"],
    ],
    negative: [
      "نانم دەخوارد",
      "نانم خوارد",
      "خواردم",
      "خواردم بەڵام",
      "خواردم، نان",
      "من نان",
      "هاتم بۆ ماڵ",
      "کتێب",
      "پیاو هات",
      "دەخۆم",
      "kitêb",
    ],
  });
});
