import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { niNegation } from "./ni-negation.js";

describe("kmr.verb.ni-negation", () => {
  ruleCases({
    rule: niNegation,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["nazanim", "nizanim"],
      ["nakarim", "nikarim"],
      ["nazanî", "nizanî"],
      ["nazane", "nizane"],
      ["nazanin", "nizanin"],
      ["nakarî", "nikarî"],
      ["nakare", "nikare"],
      ["nakarin", "nikarin"],
      ["Nazanim", "Nizanim"],
      ["Ez nazanim.", "nizanim"],
    ],
    negative: [
      "nizanim",
      "nikarim",
      "nizane",
      "naçim",
      "nabînim",
      "dizanim",
      "zanim",
      "nazik",
      "kurd",
      "nakin",
      "",
    ],
  });
});
