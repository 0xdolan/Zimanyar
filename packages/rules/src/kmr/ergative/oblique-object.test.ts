import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { obliqueObject } from "./oblique-object.js";

describe("kmr.ergative.oblique-object", () => {
  ruleCases({
    rule: obliqueObject,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Min wê dît.", "ew"],
      ["Te min dît.", "ez"],
      ["Min te dît.", "tu"],
      ["Wî me dît.", "em"],
      ["Wê wî dît.", "ew"],
      ["Min wan dît.", "ew"],
      ["Me we dît.", "hûn"],
      ["min wê dît", "ew"],
      ["Min vê dît.", "ev"],
      ["Te wê xwar.", "ew"],
    ],
    negative: [
      "Min ew dît.",
      "Te ez dîtim.",
      "Min tu dîtî.",
      "Min wê dibînim.",
      "Ez wê dibînim.",
      "Min nan xwar.",
      "Min, wê dît.",
      "Min wê.",
      "Wê hat.",
      "kurd",
      "",
    ],
  });
});
