import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { vowelGlide } from "./vowel-glide.js";

describe("kmr.morph.vowel-glide", () => {
  ruleCases({
    rule: vowelGlide,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["xanîê", "xaniyê"],
      ["çiyaê", "çiyayê"],
      ["xanîan", "xaniyan"],
      ["çiyaan", "çiyayan"],
      ["xanîek", "xaniyek"],
      ["çiyaek", "çiyayek"],
      ["Xanîê", "Xaniyê"],
      ["xanîên", "xaniyên"],
      ["çiyaên", "çiyayên"],
      ["Ez xanîê dibînim", "xaniyê"],
    ],
    negative: [
      "xaniyê",
      "çiyayê",
      "xaniyan",
      "çiyayan",
      "xaniyek",
      "malê",
      "hatin",
      "kurd",
      "roê",
      "dîan",
      "",
    ],
  });
});
