import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { tripledLetter } from "./tripled.js";

describe("kmr.orth.tripled", () => {
  ruleCases({
    rule: tripledLetter,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["kurrrd", "kurd"],
      ["baaaş", "baş"],
      ["malll", "mal"],
      ["ezzz", "ez"],
      ["kitêêêb", "kitêb"],
      ["Ez kurrrd im.", "kurd"],
      ["hatimmm", "hatim"],
      ["gellll"],
      ["bcdfg"],
      ["xwrsk"],
    ],
    negative: ["kurd", "baş", "mal", "kurr", "Kurrd", "Ez kurd im.", "kitêb", "Schmidt", "hatim", "xwe", ""],
  });
});
