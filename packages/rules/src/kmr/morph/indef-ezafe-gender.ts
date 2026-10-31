import { lemmaPos, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { genderOf, likeCase, lowered } from "../helpers.js";

const SHAPE = /^(.{2,}?)(y?)(eke|ekî)$/u;

/** "A good man" is mirovekî baş, and "a good woman" jineke baş. */
export const indefiniteEzafeGender: Rule = {
  id: "kmr.morph.indef-ezafe-gender",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [noun, adjective] of wordPairs(sentence)) {
        const [, stem = "", glide = "", ending = ""] = SHAPE.exec(lowered(noun)) ?? [];
        if (stem === "" || lemmaPos(lowered(adjective), context) !== "ADJ") continue;
        const gender = genderOf(stem, context);
        if (ending === "eke" && gender === "m") {
          found.push({
            start: noun.start,
            end: noun.end,
            suggestions: [likeCase(noun.text, `${stem}${glide}ekî`)],
          });
        } else if (ending === "ekî" && gender === "f") {
          found.push({
            start: noun.start,
            end: noun.end,
            suggestions: [likeCase(noun.text, `${stem}${glide}eke`)],
          });
        }
      }
    }
    return found;
  },
};
