import { wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { agentCliticVerb, isBareNoun } from "../helpers.js";

/** With an object before the verb, the written standard puts the clitic on the object. */
export const agentMisplaced: Rule = {
  id: "ckb.verb.agent-misplaced",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [object, verb] of wordPairs(sentence)) {
        if (!isBareNoun(object.text, context)) continue;
        const split = agentCliticVerb(verb.text, context);
        if (split !== null) {
          found.push({
            start: object.start,
            end: verb.end,
            suggestions: [`${object.text}${split.clitic} ${split.bare}`],
          });
        }
      }
    }
    return found;
  },
};
