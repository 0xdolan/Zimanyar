import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { agentMissing } from "./agent-missing.js";

describe("ckb.verb.agent-missing", () => {
  ruleCases({
    rule: agentMissing,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["من نان خوارد", "نانم"],
      ["تۆ نان خوارد", "نانت"],
      ["ئەو نان خوارد", "نانی"],
      ["ئێمە نان خوارد", "نانمان"],
      ["ئێوە نان خوارد", "نانتان"],
      ["ئەوان نان خوارد", "نانیان"],
      ["من کتێب کڕی", "کتێبم"],
      ["تۆ ماڵ کڕی", "ماڵت"],
      ["من کتێب برد", "کتێبم"],
      ["دوێنێ من نان خوارد", "نانم"],
    ],
    negative: [
      "ئەو هیچی نەگوت",
      "من نانم خوارد",
      "ئەو نانی خوارد",
      "نان خوارد",
      "من هاتم",
      "من کتێب دەخوێنم",
      "من، نان خوارد",
      "من نان",
      "پیاو نان خوارد",
      "من لە ماڵ هاتم",
      "تۆ نانت خوارد",
      "kitêb",
    ],
  });
});
