import { kmr } from "@zimanyar/core";
import { allWords, hasForm, isLemma } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { likeCase, lowered } from "../helpers.js";

const SHAPE = /^(.+[aêîoû])(ê|a|an|ên|ek|ekê|ekî|eke)$/u;

/** A suffix on a vowel-final stem takes y, and î shortens before it: xaniyê. */
export const vowelGlide: Rule = {
  id: "kmr.morph.vowel-glide",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const text = lowered(word);
      if (hasForm(text, context)) continue;
      const [, stem = "", suffix = ""] = SHAPE.exec(text) ?? [];
      if (stem === "" || (context.lexicon !== null && !isLemma(stem, context))) continue;
      const fixed = kmr.attach(stem, `y${suffix}`);
      found.push({ start: word.start, end: word.end, suggestions: [likeCase(word.text, fixed)] });
    }
    return found;
  },
};
