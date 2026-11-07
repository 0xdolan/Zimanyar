import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { directAgent } from "./direct-agent.js";

describe("kmr.ergative.direct-agent", () => {
  ruleCases({
    rule: directAgent,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Ez nan xwar.", "Min"],
      ["Tu nan xwar.", "Te"],
      ["Em nan xwar.", "Me"],
      ["Hûn nan xwar.", "We"],
      ["ez nan xwar", "min"],
      ["Ez pirtûk xwend.", "Min"],
      ["Tu pirtûk xwend.", "Te"],
      ["Em nan xwarin.", "Me"],
      ["Ez nan xwarin", "Min"],
      ["Duh ez nan xwar.", "min"],
    ],
    negative: [
      "Min nan xwar.",
      "Te nan xwar.",
      "Ez dît.",
      "Ez hatim.",
      "Ez nan dixwim.",
      "Ez te dîtim.",
      "Ew nan xwar.",
      "Ez, nan xwar.",
      "Ez nan.",
      "kurd",
      "",
    ],
  });
});
