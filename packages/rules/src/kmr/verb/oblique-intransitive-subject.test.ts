import { describe } from "vitest";
import { ruleCases } from "../../../test/helpers.js";
import { LEXICONS } from "../../../test/test-lexicons.js";
import { obliqueIntransitiveSubject } from "./oblique-intransitive-subject.js";

describe("kmr.verb.oblique-intransitive-subject", () => {
  ruleCases({
    rule: obliqueIntransitiveSubject,
    lang: "kmr",
    lexicon: LEXICONS.kmr,
    positive: [
      ["Min hatim.", "Ez"],
      ["Te hatî.", "Tu"],
      ["Me hatin.", "Em"],
      ["We hatin.", "Hûn"],
      ["Wî hat.", "Ew"],
      ["Wan hatin.", "Ew"],
      ["min hatim", "ez"],
      ["Min çûm.", "Ez"],
      ["Te çûyî.", "Tu"],
      ["Wê çû.", "Ew"],
    ],
    negative: [
      "Ez hatim.",
      "Tu hatî.",
      "Bavê min hat.",
      "Min dît.",
      "Wê bê.",
      "Min nan xwar.",
      "Te ez dîtim.",
      "Em hatin.",
      "Min, hatim.",
      "kurd",
      "",
    ],
  });
});
