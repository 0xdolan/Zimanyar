import { kmr } from "@zimanyar/core";
import { isFunctionWord, isLemma, suggestionsFor } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const HAWAR = /^[a-zçêîşû]+$/u;

/** A word the lexicon does not hold and the analyzer cannot explain. */
export const unknownWord: Rule = {
  id: "kmr.spell.unknown",
  check({ sentences }, context) {
    const { lexicon } = context;
    if (lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const { words } of sentences) {
      for (const [i, word] of words.entries()) {
        // A capital inside a sentence is a name, and a name need not be in any lexicon.
        if (i > 0 && kmr.lower(word.text) !== word.text) continue;
        const normal = kmr.normalizeWord(word.text);
        if (normal.length < 2 || !HAWAR.test(normal) || lexicon.has(word.text) || lexicon.has(normal))
          continue;
        const explained = context
          .readings(normal)
          .some(
            (reading) =>
              reading.pos === "VERB" ||
              isLemma(reading.lemma, context) ||
              isFunctionWord(reading.lemma, "kmr"),
          );
        if (!explained)
          found.push({ start: word.start, end: word.end, suggestions: suggestionsFor(normal, context) });
      }
    }
    return found;
  },
};
