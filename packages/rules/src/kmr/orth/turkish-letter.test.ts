import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { turkishLetter } from "./turkish-letter.js";

describe("kmr.orth.turkish-letter", () => {
  ruleCases({
    rule: turkishLetter,
    lang: "kmr",
    lexicon: null,
    positive: [
      ["dıçım", "diçim"],
      ["İro", "Iro"],
      ["Ez dıçım malê.", "diçim"],
      ["kürd", "kûrd"],
      ["bıra", "bira"],
      ["zımanê", "zimanê"],
      ["kırin", "kirin"],
      ["mırov", "mirov"],
      ["İzmir", "Izmir"],
      ["döst"],
    ],
    negative: [
      "diçim",
      "Iro",
      "kurd",
      "bira",
      "Erdoğan",
      "Göktürk",
      "Müslüm",
      "kitêb",
      "Ez diçim malê.",
      "کتێب",
      "",
    ],
  });
});
