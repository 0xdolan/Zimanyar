import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { arabicOnlyLetter } from "./arabic-only-letter.js";

describe("ckb.orth.arabic-only-letter", () => {
  ruleCases({
    rule: arabicOnlyLetter,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["ثەورە", "سەورە"],
      ["صەد", "سەد"],
      ["ذکر"],
      ["طەلا"],
      ["ضەرەر"],
      ["ظولم"],
      ["سوءال"],
      ["من صەد دەڵێم", "سەد"],
      ["ثابت"],
      ["صوورەت"],
    ],
    negative: [
      "سەورە",
      "سەد",
      "کتێب",
      "ماڵ",
      "ئاو",
      "من سەد دەڵێم",
      "هەر",
      "کورد",
      "زەرد",
      "بەڵام",
      "kitêb",
      "",
    ],
  });
});
