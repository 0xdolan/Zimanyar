import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** Letters that are never written double, or more than double. */
const SQUEEZE: readonly (readonly [RegExp, string])[] = [
  [/ە{2,}/gu, "ە"],
  [/ڕ{2,}|رڕ|ڕر/gu, "ڕ"],
  [/ڵ{2,}|لڵ|ڵل/gu, "ڵ"],
  [/و{3,}/gu, "وو"],
  [/ی{3,}/gu, "یی"],
  [/ئ{2,}/gu, "ئ"],
];

/** A slip of the finger, or a letter doubled for emphasis. */
export const doubledLetter: Rule = {
  id: "ckb.orth.doubled-letter",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      let fixed = word.text;
      for (const [pattern, to] of SQUEEZE) fixed = fixed.replace(pattern, to);
      if (fixed !== word.text) found.push({ start: word.start, end: word.end, suggestions: [fixed] });
    }
    return found;
  },
};
