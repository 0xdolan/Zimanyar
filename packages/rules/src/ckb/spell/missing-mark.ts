import { allWords, frequencyOf, hasForm } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { hasVerbReading } from "../helpers.js";

const PAIRS: readonly (readonly [string, string])[] = [
  ["ر", "ڕ"],
  ["ل", "ڵ"],
  ["ی", "ێ"],
  ["و", "ۆ"],
];
/** The marked form must be this much more frequent, in quarter steps of the Zipf scale: about 6 times. */
const MARGIN = 3;

/** A word that exists, but whose marked twin is far more common: گول for گوڵ. */
export const missingMark: Rule = {
  id: "ckb.spell.missing-mark",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const own = frequencyOf(word.text, context);
      if (own < 0) continue;
      // In a verb these letters mark the person: بخوێنیت and بخوێنێت are both right.
      if (context.lexicon?.form(word.text)?.upos === "VERB" || hasVerbReading(word.text, context)) continue;
      const better: string[] = [];
      for (const [bare, marked] of PAIRS) {
        for (let i = word.text.indexOf(bare); i >= 0; i = word.text.indexOf(bare, i + 1)) {
          const candidate = word.text.slice(0, i) + marked + word.text.slice(i + 1);
          if (hasForm(candidate, context) && frequencyOf(candidate, context) >= own + MARGIN)
            better.push(candidate);
        }
      }
      if (better.length > 0) found.push({ start: word.start, end: word.end, suggestions: better });
    }
    return found;
  },
};
