import { ckb } from "@zimanyar/core";
import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { agentCliticVerb } from "../helpers.js";

const NEGATIVE = "نە";

/** In the negative past the clitic comes straight after نە: نەمخوارد. */
export const negationClitic: Rule = {
  id: "ckb.verb.negation-clitic",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (!word.text.startsWith(NEGATIVE) || ckb.defaultIndex().lookup(word.text).length > 0) continue;
      const split = agentCliticVerb(word.text.slice(NEGATIVE.length), context);
      if (split !== null) {
        found.push({ start: word.start, end: word.end, suggestions: [NEGATIVE + split.clitic + split.bare] });
      }
    }
    return found;
  },
};
