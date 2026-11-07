import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { prefixContraction } from "./prefix-contraction.js";

describe("kmr.verb.prefix-contraction", () => {
  ruleCases({
    rule: prefixContraction,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["diêm", "têm"],
      ["naêm", "nayêm"],
      ["biêm", "bêm"],
      ["neêm", "neyêm"],
      ["diê", "tê"],
      ["naê", "nayê"],
      ["biê", "bê"],
      ["Diêm", "Têm"],
      ["naaxivim", "naxivim"],
      ["biaxivim", "baxivim"],
    ],
    negative: [
      "têm",
      "nayêm",
      "bêm",
      "neyêm",
      "diaxivim",
      "naxivim",
      "baxivim",
      "dibînim",
      "kurd",
      "diya",
      "",
    ],
  });
});
