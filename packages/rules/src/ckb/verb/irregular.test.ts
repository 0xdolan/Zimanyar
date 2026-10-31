import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { irregularForm } from "./irregular.js";

describe("ckb.verb.irregular", () => {
  ruleCases({
    rule: irregularForm,
    lang: "ckb",
    lexicon: LEXICONS.ckb,
    positive: [
      ["مەێ", "مەیە"],
      ["مەێن", "مەیەن"],
      ["دەوێم", "دەمەوێت"],
      ["دەوێیت", "دەتەوێت"],
      ["دەوێین", "دەمانەوێت"],
      ["ناوێم", "نامەوێت"],
      ["ناوێیت", "ناتەوێت"],
      ["ناوێین", "نامانەوێت"],
      ["ناێم", "نایەم"],
      ["ناێت", "نایەت"],
    ],
    negative: [
      "مەیە",
      "مەیەن",
      "دەمەوێت",
      "دەتەوێت",
      "دەمانەوێت",
      "نامەوێت",
      "نایەم",
      "نایەت",
      "دێم",
      "دێت",
      "بڕۆ",
      "kitêb",
    ],
  });
});
