import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const TABLE: ReadonlyMap<string, string> = new Map(
  Object.entries({ ș: "ş", Ș: "Ş", š: "ş", Š: "Ş", č: "ç", Č: "Ç" }),
);

/** Look-alikes from Romanian and Czech keyboards: ș, š and č. */
export const wrongCedilla: Rule = {
  id: "kmr.orth.cedilla",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const fixed = Array.from(word.text, (letter) => TABLE.get(letter) ?? letter).join("");
      if (fixed !== word.text) found.push({ start: word.start, end: word.end, suggestions: [fixed] });
    }
    return found;
  },
};
