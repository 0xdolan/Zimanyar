import { describe, expect, it } from "vitest";
import { ruleCases, runOne } from "../../../test/helpers.js";
import { repeatedWord } from "./word.js";

describe("any.repeat.word", () => {
  ruleCases({
    rule: repeatedWord,
    lang: "kmr",
    positive: [
      ["Ez ez hatim.", "Ez"],
      ["Ez hatim hatim.", "hatim"],
      ["Ez Ez hatim.", "Ez"],
      ["Ez ez", "Ez"],
      ["Kitêb kitêb baş e.", "Kitêb"],
      ["min min dît", "min"],
      ["li li malê", "li"],
      ["من من هاتم.", "من"],
      ["ئەو ئەو هات", "ئەو"],
      ["کتێب کتێب", "کتێب"],
    ],
    negative: [
      "Ez hatim.",
      "Hêdî hêdî hat.",
      "Zû zû hat.",
      "gelek gelek baş",
      "yek yek",
      "زوو زوو هات",
      "هێواش هێواش",
      "Ez. Ez hatim.",
      "Ez, ez hatim.",
      "kitêb 12 12",
      "کەم کەم",
      "",
    ],
  });

  it("names the word in its message", () => {
    expect(runOne(repeatedWord, "Ez ez", "kmr")[0]?.message.params).toEqual({ word: "ez" });
  });
});
