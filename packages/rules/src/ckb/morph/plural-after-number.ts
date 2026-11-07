import { functionWordsFor } from "@zimanyar/core";
import { frequencyOf, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { isNounLike } from "../helpers.js";

const PLURAL = /^(.{2,}?)(?:ی?ان)$/u;

/** After a number the noun stays singular: سێ پیاو. */
export const pluralAfterNumber: Rule = {
  id: "ckb.morph.plural-after-number",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const functionWords = functionWordsFor("ckb");
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [first, second] of wordPairs(sentence)) {
        if (functionWords.get(first.text)?.[0] !== "NUM") continue;
        if (second.text.endsWith("\u06a9\u0627\u0646")) continue;
        const stem = PLURAL.exec(second.text)?.[1];
        if (stem === undefined || !isNounLike(stem, context)) continue;
        // The lexicon also lists plurals as lemmas, so what tells ژیان from پیاوان is the stem's
        // own frequency: a real plural is rarer than its singular.
        if (frequencyOf(second.text, context) <= frequencyOf(stem, context)) {
          found.push({ start: second.start, end: second.end, suggestions: [stem] });
        }
      }
    }
    return found;
  },
};
