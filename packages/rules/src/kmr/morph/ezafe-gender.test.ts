import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { ezafeGender } from "./ezafe-gender.js";

describe("kmr.morph.ezafe-gender", () => {
  ruleCases({
    rule: ezafeGender,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["bava min", "bavê"],
      ["malê min", "mala"],
      ["Bava min hat.", "Bavê"],
      ["gunda me", "gundê"],
      ["mirova baş", "mirovê"],
      ["bava te", "bavê"],
      ["keçê min", "keça"],
      ["jinê te", "jina"],
      ["Malê me", "Mala"],
      ["xaniya me", "xaniyê"],
    ],
    negative: [
      "bavê min",
      "mala min",
      "gundê me",
      "mirovê baş",
      "keça min",
      "li malê",
      "Jinê nan xwar",
      "bav",
      "mal min",
      "bava",
      "kurd",
      "",
    ],
  });
});
