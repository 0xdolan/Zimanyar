import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const LETTER = /\p{L}/u;

const TAP = "ر";
const TRILL = "ڕ";

/** Kurdish has no word-initial tap: ر at the start of a word is always ڕ. */
export const initialR: Rule = {
  id: "ckb.orth.initial-r",
  check({ sentences, text }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      // Part of a longer run of letters, such as a word split by a Latin letter.
      if (word.start > 0 && LETTER.test(text[word.start - 1] as string)) continue;
      if (word.text.startsWith(TAP)) {
        found.push({ start: word.start, end: word.end, suggestions: [TRILL + word.text.slice(1)] });
      }
    }
    return found;
  },
};
