import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { agentMisplaced } from "./agent-misplaced.js";

describe("ckb.verb.agent-misplaced", () => {
  ruleCases({
    rule: agentMisplaced,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["من نان خواردم", "نانم خوارد"],
      ["نان خواردم", "نانم خوارد"],
      ["تۆ نان خواردت", "نانت خوارد"],
      ["ئێمە نان خواردمان", "نانمان خوارد"],
      ["ئەوان نان خواردیان", "نانیان خوارد"],
      ["کتێب کڕیم", "کتێبم کڕی"],
      ["ماڵ کڕیمان", "ماڵمان کڕی"],
      ["کتێب بردت", "کتێبت برد"],
      ["نان بردم", "نانم برد"],
      ["من کتێب بردم", "کتێبم برد"],
    ],
    negative: [
      "من نانم خوارد",
      "نانم خوارد",
      "من هاتم",
      "خواردم",
      "من لە ماڵ هاتم",
      "نان، خواردم",
      "من نان دەخۆم",
      "پیاو هات",
      "کتێب",
      "بەڵام هاتم",
      "kitêb",
    ],
  });
});
