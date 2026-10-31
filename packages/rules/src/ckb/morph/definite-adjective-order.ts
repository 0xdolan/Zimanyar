import { ckb } from "@zimanyar/core";
import { lemmaPos, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule, Token } from "../../model.js";

const DEFINITE = /^(.{2,}?)(ە?کە|ە?کان)$/u;

/** "The good man" puts the definite ending on the adjective: پیاوە باشەکە. */
export const definiteAdjectiveOrder: Rule = {
  id: "ckb.morph.definite-adjective-order",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [first, second] of wordPairs(sentence)) {
        const shape = DEFINITE.exec(first.text);
        if (shape === null || lemmaPos(second.text, context) !== "ADJ") continue;
        const [, stem = "", ending = ""] = shape;
        if (lemmaPos(stem, context) !== "NOUN") continue;
        // Only as a phrase on its own: with more words the adjective may be doing something else.
        if (sentence.words.at(-1) !== (second as Token)) continue;
        const linked = stem + (ckb.endsWithVowel(stem) ? "یە" : "ە");
        const definite = ending.endsWith("ان") ? "ەکان" : "ەکە";
        const adjective = ckb.endsWithVowel(second.text)
          ? second.text + definite.slice(1)
          : second.text + definite;
        found.push({ start: first.start, end: second.end, suggestions: [`${linked} ${adjective}`] });
      }
    }
    return found;
  },
};
