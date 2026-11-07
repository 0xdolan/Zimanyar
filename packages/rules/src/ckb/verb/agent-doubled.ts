import { ckb } from "@zimanyar/core";
import { isLemma, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { agentCliticVerb } from "../helpers.js";

/** The third-person clitic is also the ezafe, so it proves nothing here. */
const AMBIGUOUS = "ی";

/** The agent is marked once: on the object or on the verb, not both. */
export const agentDoubled: Rule = {
  id: "ckb.verb.agent-doubled",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [object, verb] of wordPairs(sentence)) {
        const [stem, clitic] = ckb.splitEnclitic(object.text);
        if (clitic === null || clitic === AMBIGUOUS || isLemma(object.text, context)) continue;
        if (context.lexicon !== null && !isLemma(stem, context)) continue;
        const split = agentCliticVerb(verb.text, context);
        if (split !== null && split.clitic === clitic) {
          found.push({ start: verb.start, end: verb.end, suggestions: [split.bare] });
        }
      }
    }
    return found;
  },
};
