import { lemmaPos, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule, Token } from "../../model.js";
import { hasVerbReading } from "../helpers.js";

/** A noun and an adjective are joined by the ezafe: پیاوی باش. */
export const ezafeMissing: Rule = {
  id: "ckb.morph.ezafe-missing",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [first, second] of wordPairs(sentence)) {
        if (lemmaPos(first.text, context) !== "NOUN" || lemmaPos(second.text, context) !== "ADJ") continue;
        // کوڕ باش دەخوێنێت: before a verb, the adjective may be an adverb.
        const next = sentence.words[sentence.words.indexOf(second as Token) + 1];
        if (next !== undefined && hasVerbReading(next.text, context)) continue;
        found.push({ start: first.start, end: first.end, suggestions: [`${first.text}ی`] });
      }
    }
    return found;
  },
};
