import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { indefiniteEzafeGender } from "./indef-ezafe-gender.js";

describe("kmr.morph.indef-ezafe-gender", () => {
  ruleCases({
    rule: indefiniteEzafeGender,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["miroveke baş", "mirovekî"],
      ["jinekî baş", "jineke"],
      ["baveke baş", "bavekî"],
      ["keçekî baş", "keçeke"],
      ["malekî baş", "maleke"],
      ["gundeke baş", "gundekî"],
      ["Miroveke baş hat.", "Mirovekî"],
      ["Jinekî baş hat.", "Jineke"],
      ["miroveke mezin", "mirovekî"],
      ["jinekî mezin", "jineke"],
    ],
    negative: [
      "mirovekî baş",
      "jineke baş",
      "bavekî baş",
      "keçeke baş",
      "miroveke",
      "jinekî",
      "mirovekî hat",
      "jinekî dît",
      "baş mirovekî",
      "kurd",
      "",
    ],
  });
});
