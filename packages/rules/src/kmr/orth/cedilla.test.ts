import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { wrongCedilla } from "./cedilla.js";

describe("kmr.orth.cedilla", () => {
  ruleCases({
    rule: wrongCedilla,
    lang: "kmr",
    lexicon: null,
    positive: [
      ["șev", "şev"],
      ["čav", "çav"],
      ["šev", "şev"],
      ["Șev", "Şev"],
      ["Čav", "Çav"],
      ["Šam", "Şam"],
      ["baș", "baş"],
      ["biș", "biş"],
      ["seč", "seç"],
      ["Ez baș im.", "baş"],
    ],
    negative: ["şev", "çav", "baş", "Şam", "Ez baş im.", "kurd", "kitêb", "seç", "s", "کتێب", ""],
  });
});
