import { kmr } from "@zimanyar/core";
import { wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { genderOf, isBareNoun, lowered } from "../helpers.js";

/** Not bi: bi xêr and bi kurdî take no ending, and fixed phrases like them are too many to list. */
const PREPOSITIONS = new Set(["li", "ji", "di", "bo", "ber"]);

/**
 * A noun after a preposition is oblique: li malê. This covers feminine nouns, whose ending is always
 * written. The lessons note that the masculine -î is often dropped, so its absence is no mistake.
 */
export const caseAfterPreposition: Rule = {
  id: "kmr.morph.case-after-preposition",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [preposition, noun] of wordPairs(sentence)) {
        if (!PREPOSITIONS.has(lowered(preposition))) continue;
        const word = lowered(noun);
        // A language name such as kurdî takes no ending.
        if (noun.text !== word || word.endsWith("\u00ee")) continue;
        if (!isBareNoun(word, context) || genderOf(word, context) !== "f") continue;
        const oblique = kmr.decline(word, "f").find(([cell]) => cell === "def.obl.sg")?.[1];
        if (oblique) found.push({ start: noun.start, end: noun.end, suggestions: [oblique] });
      }
    }
    return found;
  },
};
