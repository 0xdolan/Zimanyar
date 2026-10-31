import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { sentenceCapital } from "./capital.js";

describe("kmr.orth.capital", () => {
  ruleCases({
    rule: sentenceCapital,
    lang: "kmr",
    lexicon: null,
    positive: [
      ["iro baran dibare.", "Iro"],
      ["ez hatim.", "Ez"],
      ["tu çûyî.", "Tu"],
      ["îro hat.", "Îro"],
      ["şev hat.", "Şev"],
      ["çav baş e.", "Çav"],
      ["Ez hatim. tu çûyî.", "Tu"],
      ["ûrmî xweş e.", "Ûrmî"],
      ["êvar hat.", "Êvar"],
      ["kitêb baş e!", "Kitêb"],
    ],
    negative: [
      "yek, du, sê",
      "mala min",
      "kitêb baş e",
      "Iro baran dibare.",
      "Ez hatim.",
      "kitêb",
      "12 kitêb hene.",
      "« ez hatim »",
      "- ez hatim",
      "HDP hat.",
      "Şev hat.",
      "Ez hatim. Tu çûyî.",
      "من هاتم.",
      "",
    ],
  });
});
