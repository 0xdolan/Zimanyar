import { allWords, hasForm } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const LETTER = /\p{L}/u;

const SEAT = "ئ";
const ALEF = "ا";
const AE = "ە";
const BARE = new Set([ALEF, AE, "ێ", "ۆ"]);

/** A word never starts with a bare vowel: it needs the seat ئ. */
export const initialVowel: Rule = {
  id: "ckb.orth.initial-vowel",
  check({ sentences, text }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      // Part of a longer run of letters, such as a word split by a Latin letter.
      if (word.start > 0 && LETTER.test(text[word.start - 1] as string)) continue;
      const first = word.text[0] as string;
      if (!BARE.has(first) || word.text.length < 2) continue;
      const seated = SEAT + word.text;
      // An alef may stand for a lost short vowel, as in اسپ for ئەسپ.
      const shortened = first === ALEF ? SEAT + AE + word.text.slice(1) : seated;
      const suggestions = hasForm(shortened, context) && !hasForm(seated, context) ? [shortened] : [seated];
      found.push({ start: word.start, end: word.end, suggestions });
    }
    return found;
  },
};
