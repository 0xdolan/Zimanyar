import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { knownVariant } from "./variant.js";

describe("kmr.spell.variant", () => {
  ruleCases({
    rule: knownVariant,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["kitib", "kitêb"],
      ["pirtuke", "pirtûk"],
      ["Kitib", "kitêb"],
      ["Ez kitib dixwînim", "kitêb"],
      ["kitib û pirtuke", "kitêb"],
      ["min kitib", "kitêb"],
      ["pirtuke baş", "pirtûk"],
      ["kitib baş", "kitêb"],
      ["baş kitib", "kitêb"],
      ["li kitib", "kitêb"],
    ],
    negative: ["kitêb", "pirtûk", "Ez kitêb dixwînim", "mal", "baş", "li", "Ez", "kurd", "malê", "بەلام", ""],
  });
});
