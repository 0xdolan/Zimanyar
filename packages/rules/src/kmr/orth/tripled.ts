import { kmr } from "@zimanyar/core";
import { allWords, hasForm, suggestionsFor } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const TRIPLED = /(\p{L})\1{2,}/gu;
const CAPITAL = /^\p{Lu}/u;

/** A letter three times, or a cluster no Kurmanji word has. */
export const tripledLetter: Rule = {
  id: "kmr.orth.tripled",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (TRIPLED.test(word.text)) {
        TRIPLED.lastIndex = 0;
        const single = word.text.replace(TRIPLED, "$1");
        const double = word.text.replace(TRIPLED, "$1$1");
        // rr is a real letter, so kurrrd could lose one r or two: the lexicon decides.
        const best = !hasForm(single, context) && hasForm(double, context) ? double : single;
        found.push({ start: word.start, end: word.end, suggestions: [best] });
      } else if (!CAPITAL.test(word.text) && !hasForm(word.text, context)) {
        if (kmr.validateWord(word.text).includes("four consonants in a row")) {
          found.push({ start: word.start, end: word.end, suggestions: suggestionsFor(word.text, context) });
        }
      }
      TRIPLED.lastIndex = 0;
    }
    return found;
  },
};
