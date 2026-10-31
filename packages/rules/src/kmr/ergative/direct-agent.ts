import type { RawFinding, Rule, Token } from "../../model.js";
import { DIRECT_TO_OBLIQUE, isBareNoun, isErgativePast, likeCase, lowered } from "../helpers.js";

/** The doer of a past transitive verb is oblique: Min nan xwar. */
export const directAgent: Rule = {
  id: "kmr.ergative.direct-agent",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (let i = 0; i + 2 < tokens.length; i++) {
        const [agent, object, verb] = [tokens[i], tokens[i + 1], tokens[i + 2]] as [Token, Token, Token];
        const oblique = DIRECT_TO_OBLIQUE[lowered(agent)];
        // Ez dît alone is correct: "he saw me". A noun as well leaves the pronoun no other job.
        if (oblique === undefined || !isBareNoun(lowered(object), context) || !isErgativePast(lowered(verb)))
          continue;
        found.push({ start: agent.start, end: agent.end, suggestions: [likeCase(agent.text, oblique)] });
      }
    }
    return found;
  },
};
