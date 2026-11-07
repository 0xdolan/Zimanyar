import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { mixedScript } from "./mixed.js";

describe("any.script.mixed", () => {
  ruleCases({
    rule: mixedScript,
    lang: "kmr",
    positive: [
      ["kitێb"],
      ["کتێbەکە"],
      ["aب"],
      ["باa"],
      ["Ez kitێb dixwînim."],
      ["من کتێb دەخوێنم."],
      ["xێr"],
      ["zمان"],
      ["کورdی"],
      ["Kurدî"],
      ["a‌ب"],
    ],
    negative: [
      "kitêb",
      "کتێب",
      "Ez kitêb dixwînim.",
      "من کتێب دەخوێنم.",
      "kitêb کتێب",
      "HDP'ê",
      "123",
      "abc123",
      "کوردی‌یەکە",
      "bakûr-başûr",
      "",
    ],
  });
});
