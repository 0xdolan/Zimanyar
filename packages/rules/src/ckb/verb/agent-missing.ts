import type { RawFinding, Rule, Token } from "../../model.js";
import { externalAgentVerb, isBareNoun, PRONOUN_CLITIC } from "../helpers.js";

/** In the past of a transitive verb, the object carries a clitic for the agent: من نانم خوارد. */
export const agentMissing: Rule = {
  id: "ckb.verb.agent-missing",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (let i = 0; i + 2 < tokens.length; i++) {
        const [pronoun, object, verb] = [tokens[i], tokens[i + 1], tokens[i + 2]] as [Token, Token, Token];
        const clitic = PRONOUN_CLITIC[pronoun.text];
        if (clitic === undefined || !isBareNoun(object.text, context)) continue;
        if (externalAgentVerb(verb.text, context)) {
          found.push({ start: object.start, end: object.end, suggestions: [object.text + clitic] });
        }
      }
    }
    return found;
  },
};
