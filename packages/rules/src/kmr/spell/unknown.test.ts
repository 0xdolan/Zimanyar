import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { unknownWord } from "./unknown.js";

describe("kmr.spell.unknown", () => {
  ruleCases({
    rule: unknownWord,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["kitab", "kitêb"],
      ["pirtuk", "pirtûk"],
      ["mirof", "mirov"],
      ["Ez kitab dixwînim", "kitêb"],
      ["zzzz"],
      ["qqqqa"],
      ["xxxê"],
      ["malq", "mal"],
      ["bavv", "bav"],
      ["Kitab", "kitêb"],
    ],
    negative: [
      "kitêb",
      "pirtûk",
      "mirov",
      "malê",
      "kitêba",
      "mirovekî",
      "dibînim",
      "Ez",
      "li",
      "Ez Mihemed dibînim",
      "12",
      "کتێب",
    ],
  });
});
