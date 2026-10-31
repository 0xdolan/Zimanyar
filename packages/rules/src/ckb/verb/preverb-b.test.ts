import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { preverbB } from "./preverb-b.js";

describe("ckb.verb.preverb-b", () => {
  ruleCases({
    rule: preverbB,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["هەڵبگرە", "هەڵگرە"],
      ["وەربگرە", "وەرگرە"],
      ["هەڵبگرن", "هەڵگرن"],
      ["وەربگرن", "وەرگرن"],
      ["هەڵبگرم", "هەڵگرم"],
      ["وەربگرم", "وەرگرم"],
      ["هەڵبگریت", "هەڵگریت"],
      ["وەربگرین", "وەرگرین"],
      ["هەڵببژێرە", "هەڵبژێرە"],
      ["من هەڵبگرم", "هەڵگرم"],
    ],
    negative: [
      "دەرگاکە دابخە",
      "هەڵگرە",
      "وەرگرە",
      "بگرە",
      "هەڵگرم",
      "هەڵبژێرە",
      "دەرکردن",
      "هەڵدەگرم",
      "بەڵام",
      "هەڵبەت",
      "kitêb",
      "",
    ],
  });
});
