import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { curlyApostrophe } from "./apostrophe.js";

describe("kmr.orth.apostrophe", () => {
  ruleCases({
    rule: curlyApostrophe,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["HDP’ê", "HDP'ê"],
      ["Ew’ê hat.", "Ew'ê"],
      ["HDP‘yê", "HDP'yê"],
      ["HDP`ê", "HDP'ê"],
      ["HDP´ê", "HDP'ê"],
      ["Ankara’yê", "Ankara'yê"],
      ["BDP’ê", "BDP'ê"],
      ["EU’yê", "EU'yê"],
      ["NATO’yê", "NATO'yê"],
      ["Ez HDP’ê dibînim.", "HDP'ê"],
    ],
    negative: [
      "HDP'ê",
      "Ew'ê hat.",
      "‘gotin’",
      "’erd",
      "erd’",
      "kurd",
      "kitêb",
      "Ez hatim.",
      "'erd",
      "HDP",
      "",
    ],
  });
});
