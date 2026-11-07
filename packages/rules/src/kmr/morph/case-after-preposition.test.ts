import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { caseAfterPreposition } from "./case-after-preposition.js";

describe("kmr.morph.case-after-preposition", () => {
  ruleCases({
    rule: caseAfterPreposition,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["li mal", "malê"],
      ["ji jin", "jinê"],
      ["ber jin", "jinê"],
      ["di mal", "malê"],
      ["Ez li mal im.", "malê"],
      ["ji pirtûk", "pirtûkê"],
      ["bo jin", "jinê"],
      ["li jin", "jinê"],
      ["ji keç", "keçê"],
      ["ber mal", "malê"],
    ],
    negative: [
      "Bi xêr hatî!",
      "bi keç",
      "Ev pirtûk bi kurdî hatiye nivîsîn.",
      "di kurdî de",
      "li malê",
      "ji jinê",
      "li gund",
      "ji bav",
      "li Kurdistan",
      "bi kurdî",
      "mal",
      "li ser",
      "li, mal",
      "bi mirov",
      "kurd",
      "",
    ],
  });
});
