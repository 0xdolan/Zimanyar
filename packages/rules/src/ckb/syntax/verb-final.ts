import type { RawFinding, Rule, Token } from "../../model.js";
import { agentCliticVerb, isBareNoun, progressiveAgentVerb } from "../helpers.js";

/** In a plain clause the verb comes last, so an object after it is worth a second look. */
export const verbFinal: Rule = {
  id: "ckb.syntax.verb-final",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const { words } of sentences) {
      const object = words.at(-1);
      const verb = words.at(-2) as Token | undefined;
      if (object === undefined || verb === undefined || object.index !== verb.index + 1) continue;
      if (!isBareNoun(object.text, context)) continue;
      const progressive = progressiveAgentVerb(verb.text, context);
      const perfective = agentCliticVerb(verb.text, context);
      if (progressive !== null) {
        const suggestion = `${object.text}${progressive.clitic} ${progressive.bare}`;
        found.push({ start: verb.start, end: object.end, suggestions: [suggestion] });
      } else if (perfective !== null) {
        const suggestion = `${object.text}${perfective.clitic} ${perfective.bare}`;
        found.push({ start: verb.start, end: object.end, suggestions: [suggestion] });
      }
    }
    return found;
  },
};
