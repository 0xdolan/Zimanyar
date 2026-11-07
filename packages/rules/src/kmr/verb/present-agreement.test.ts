import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { presentAgreement } from "./present-agreement.js";

describe("kmr.verb.present-agreement", () => {
  ruleCases({
    rule: presentAgreement,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Ez diçe.", "diçim"],
      ["Tu diçim.", "diçî"],
      ["Ew diçim.", "diçe"],
      ["Em diçim.", "diçin"],
      ["Hûn diçe.", "diçin"],
      ["Ez dibîne.", "dibînim"],
      ["Tu dibînim.", "dibînî"],
      ["Ez naçe.", "naçim"],
      ["Ez te dibîne.", "dibînim"],
      ["ez diçe", "diçim"],
    ],
    negative: [
      "Tu li ku dijî?",
      "Ez diçim.",
      "Tu diçî.",
      "Ew diçe.",
      "Ew diçin.",
      "Em diçin.",
      "Hûn diçin.",
      "Ez te dibînim.",
      "Diçim.",
      "Pirtûk diçe.",
      "Ez hatim.",
      "Ez.",
      "",
    ],
  });
});
