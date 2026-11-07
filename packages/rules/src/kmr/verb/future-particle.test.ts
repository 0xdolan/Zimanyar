import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { futureParticle } from "./future-particle.js";

describe("kmr.verb.future-particle", () => {
  ruleCases({
    rule: futureParticle,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Ez ê diçim.", "biçim"],
      ["Tu dê dibînî.", "bibînî"],
      ["Ew ê diçe.", "biçe"],
      ["Em ê diçin.", "biçin"],
      ["Hûn dê diçin.", "biçin"],
      ["Ez dê diçim.", "biçim"],
      ["Ez ê dibînim.", "bibînim"],
      ["Tu ê diçî.", "biçî"],
      ["Ez ê têm.", "bêm"],
      ["Ez ê naçim.", "neçim"],
    ],
    negative: [
      "Ez ê biçim.",
      "Tu dê bibînî.",
      "Ew ê biçe.",
      "Ez diçim.",
      "Ez ê.",
      "Ez ê, diçim.",
      "malê diçim",
      "Ez ê neçim.",
      "Min dît.",
      "kurd",
      "",
    ],
  });
});
