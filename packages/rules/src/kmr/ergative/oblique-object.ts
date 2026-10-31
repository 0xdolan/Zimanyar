import type { RawFinding, Rule, Token } from "../../model.js";
import { isErgativePast, likeCase, lowered, OBLIQUE_TO_DIRECT } from "../helpers.js";

/** The object of a past transitive verb is direct: Min ew dît. */
export const obliqueObject: Rule = {
  id: "kmr.ergative.oblique-object",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (let i = 0; i + 2 < tokens.length; i++) {
        const [agent, object, verb] = [tokens[i], tokens[i + 1], tokens[i + 2]] as [Token, Token, Token];
        const direct = OBLIQUE_TO_DIRECT[lowered(object)];
        if (OBLIQUE_TO_DIRECT[lowered(agent)] === undefined || direct === undefined) continue;
        if (isErgativePast(lowered(verb))) {
          found.push({ start: object.start, end: object.end, suggestions: [likeCase(object.text, direct)] });
        }
      }
    }
    return found;
  },
};
