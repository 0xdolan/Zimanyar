import { ckb } from "@zimanyar/core";
import { allWords, hasForm, isLemma } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** The ending, and what may follow it on the same word. */
const SHAPE = /^(.{2,}?)(ەکە|ەکان|کە|کان)(م|ت|ی|مان|تان|یان|ش|یش|دا)?$/u;
const GLIDE_BEFORE = new Set(["ی", "ێ"]);

/** "The" follows the sound before it: ەکە after a consonant, کە after a vowel. */
export const definiteAllomorph: Rule = {
  id: "ckb.morph.definite-allomorph",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (hasForm(word.text, context)) continue;
      const shape = SHAPE.exec(word.text);
      if (shape === null) continue;
      const [, stem = "", ending = "", rest = ""] = shape;
      const longForm = ending.startsWith("ە");
      const plural = ending.endsWith("ان");
      // ماسییەکە is ماسی, the glide and یەکە: read as ماسیی and ەکە it only looks wrong.
      if (longForm && stem.endsWith("یی")) continue;
      const vowelFinal = ckb.endsWithVowel(stem);
      if (longForm && vowelFinal && (context.lexicon === null || isLemma(stem, context))) {
        // After ی or ێ a glide is written: ماسییەکە.
        const short = plural ? "کان" : "کە";
        const glide = GLIDE_BEFORE.has(stem.at(-1) as string) ? "یە" : "";
        found.push({ start: word.start, end: word.end, suggestions: [stem + glide + short + rest] });
      } else if (!longForm && !vowelFinal && isLemma(stem, context)) {
        found.push({ start: word.start, end: word.end, suggestions: [`${stem}ە${ending}${rest}`] });
      }
    }
    return found;
  },
};
