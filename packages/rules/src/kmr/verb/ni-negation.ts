import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { likeCase, lowered } from "../helpers.js";

const WRONG = /^na(zan|kar)(im|î|e|in)$/u;

/** zanîn and karîn negate with ni-: nizanim, nikarim. */
export const niNegation: Rule = {
  id: "kmr.verb.ni-negation",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const shape = WRONG.exec(lowered(word));
      if (shape !== null) {
        found.push({
          start: word.start,
          end: word.end,
          suggestions: [likeCase(word.text, `ni${shape[1]}${shape[2]}`)],
        });
      }
    }
    return found;
  },
};
