import { ckb } from "@zimanyar/core";
import { allWords, hasForm, isLemma } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const SHAPE = /^(.{2,}?)(ێک|یەک)(ی)?$/u;

/** "A" follows the sound before it: ێک after a consonant, یەک after a vowel. */
export const indefiniteAllomorph: Rule = {
  id: "ckb.morph.indef-allomorph",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (hasForm(word.text, context)) continue;
      const shape = SHAPE.exec(word.text);
      if (shape === null) continue;
      const [, stem = "", ending = "", ezafe = ""] = shape;
      const vowelFinal = ckb.endsWithVowel(stem);
      if (ending === "ێک" && vowelFinal && (context.lexicon === null || isLemma(stem, context))) {
        found.push({ start: word.start, end: word.end, suggestions: [`${stem}یەک${ezafe}`] });
      } else if (ending !== "ێک" && !vowelFinal && isLemma(stem, context)) {
        found.push({ start: word.start, end: word.end, suggestions: [`${stem}ێک${ezafe}`] });
      }
    }
    return found;
  },
};
