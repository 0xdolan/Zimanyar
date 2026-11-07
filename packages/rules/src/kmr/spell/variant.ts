import { kmr } from "@zimanyar/core";
import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** A spelling the corpus shows to be a variant of a far more common standard one. */
export const knownVariant: Rule = {
  id: "kmr.spell.variant",
  check({ sentences }, { lexicon }) {
    if (lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const standard = lexicon.standardSpelling(kmr.normalizeWord(word.text));
      if (standard !== null && standard !== word.text) {
        found.push({ start: word.start, end: word.end, suggestions: [standard] });
      }
    }
    return found;
  },
};
