import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { agentDoubled } from "./agent-doubled.js";

describe("ckb.verb.agent-doubled", () => {
  ruleCases({
    rule: agentDoubled,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["نانم خواردم", "خوارد"],
      ["نانت خواردت", "خوارد"],
      ["نانمان خواردمان", "خوارد"],
      ["نانتان خواردتان", "خوارد"],
      ["نانیان خواردیان", "خوارد"],
      ["کتێبم کڕیم", "کڕی"],
      ["کتێبمان کڕیمان", "کڕی"],
      ["ماڵم کڕیم", "کڕی"],
      ["من نانم خواردم", "خوارد"],
      ["کتێبت بردت", "برد"],
    ],
    negative: [
      "نانم خوارد",
      "نانی خواردی",
      "نان خواردم",
      "نانم خواردت",
      "نانم",
      "خواردم",
      "نانم، خواردم",
      "کتێبم هات",
      "پیاوێک هات",
      "من هاتم",
      "kitêb",
    ],
  });
});
