import { allWords, suggestionsFor } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const ALWAYS: ReadonlyMap<string, string> = new Map([
  ["ı", "i"],
  ["İ", "I"],
]);
const IN_ORDINARY_WORDS: ReadonlyMap<string, string> = new Map([
  ["ü", "û"],
  ["Ü", "Û"],
]);
const NO_KURDISH_EQUIVALENT = /[ğĞöÖ]/u;
const isCapitalised = (word: string) => /^\p{Lu}/u.test(word);

/** Letters of Turkish keyboards. ğ, ö and ü may belong to a name, so a capitalised word keeps them. */
export const turkishLetter: Rule = {
  id: "kmr.orth.turkish-letter",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const name = isCapitalised(word.text);
      const fixed = Array.from(
        word.text,
        (letter) => ALWAYS.get(letter) ?? (name ? letter : (IN_ORDINARY_WORDS.get(letter) ?? letter)),
      ).join("");
      if (!name && NO_KURDISH_EQUIVALENT.test(word.text)) {
        found.push({ start: word.start, end: word.end, suggestions: suggestionsFor(fixed, context) });
      } else if (fixed !== word.text) {
        found.push({ start: word.start, end: word.end, suggestions: [fixed] });
      }
    }
    return found;
  },
};
