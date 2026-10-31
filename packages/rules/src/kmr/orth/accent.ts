import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const TABLE: ReadonlyMap<string, string> = new Map(
  Object.entries({
    é: "ê",
    è: "ê",
    ë: "ê",
    ē: "ê",
    ě: "ê",
    É: "Ê",
    È: "Ê",
    Ë: "Ê",
    Ē: "Ê",
    í: "î",
    ì: "î",
    ï: "î",
    ī: "î",
    Í: "Î",
    Ì: "Î",
    Ï: "Î",
    Ī: "Î",
    ú: "û",
    ù: "û",
    ū: "û",
    Ú: "Û",
    Ù: "Û",
    Ū: "Û",
  }),
);

/** Accented vowels typed for the circumflex ones: é for ê. */
export const wrongAccent: Rule = {
  id: "kmr.orth.accent",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const fixed = Array.from(word.text, (letter) => TABLE.get(letter) ?? letter).join("");
      if (fixed !== word.text) found.push({ start: word.start, end: word.end, suggestions: [fixed] });
    }
    return found;
  },
};
