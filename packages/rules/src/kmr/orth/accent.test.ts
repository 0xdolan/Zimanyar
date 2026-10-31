import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { wrongAccent } from "./accent.js";

describe("kmr.orth.accent", () => {
  ruleCases({
    rule: wrongAccent,
    lang: "kmr",
    lexicon: null,
    positive: [
      ["şéwe", "şêwe"],
      ["Kurdí", "Kurdî"],
      ["kitéb", "kitêb"],
      ["pirtúk", "pirtûk"],
      ["malè", "malê"],
      ["zimanë", "zimanê"],
      ["rúmet", "rûmet"],
      ["Éz", "Êz"],
      ["īn", "în"],
      ["Ez şéwe dibînim.", "şêwe"],
    ],
    negative: [
      "şêwe",
      "Kurdî",
      "kitêb",
      "pirtûk",
      "malê",
      "zimanê",
      "Ez şêwe dibînim.",
      "kurd",
      "a",
      "کتێب",
      "",
    ],
  });
});
