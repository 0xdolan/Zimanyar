import { allWords, suggestionsFor } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const ARABIC_ONLY = /[ثذصضطظء]/u;

/** A letter Kurdish does not use, usually from a loanword kept in its Arabic spelling. */
export const arabicOnlyLetter: Rule = {
  id: "ckb.orth.arabic-only-letter",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (ARABIC_ONLY.test(word.text)) {
        found.push({ start: word.start, end: word.end, suggestions: suggestionsFor(word.text, context) });
      }
    }
    return found;
  },
};
