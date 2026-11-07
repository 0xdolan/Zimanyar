import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { preverbBi } from "./preverb-bi.js";

describe("kmr.verb.preverb-bi", () => {
  ruleCases({
    rule: preverbBi,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["birabe", "rabe"],
      ["bivekim", "vekim"],
      ["Birabe", "Rabe"],
      ["birabin", "rabin"],
      ["biderkeve", "derkeve"],
      ["bihilgire", "hilgire"],
      ["bivexwe", "vexwe"],
      ["biçêke", "çêke"],
      ["birabim", "rabim"],
      ["Ez birabim.", "rabim"],
    ],
    negative: ["rabe", "vekim", "bibe", "bikim", "biçim", "derkeve", "bira", "birîn", "kurd", "bixwe", ""],
  });
});
