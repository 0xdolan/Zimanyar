import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { ergativeAgreement } from "./agreement.js";

describe("kmr.ergative.agreement", () => {
  ruleCases({
    rule: ergativeAgreement,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Min tu dîtim.", "dîtî"],
      ["Te ez dîtî.", "dîtim"],
      ["Min tu dît.", "dîtî"],
      ["Wî ez dît.", "dîtim"],
      ["Wê tu dît.", "dîtî"],
      ["Me tu dîtin.", "dîtî"],
      ["Min hûn dîtim.", "dîtin"],
      ["Te em dîtî.", "dîtin"],
      ["Wan ez dîtin.", "dîtim"],
      ["Min tu xwarim.", "xwarî"],
    ],
    negative: [
      "Min tu dîtî.",
      "Te ez dîtim.",
      "Min ew dît.",
      "Min ew dîtin.",
      "Min hûn dîtin.",
      "Min sêv xwarin.",
      "Min nan xwar.",
      "Dîtim.",
      "Ez hatim.",
      "Ez te dibînim.",
      "",
    ],
  });
});
