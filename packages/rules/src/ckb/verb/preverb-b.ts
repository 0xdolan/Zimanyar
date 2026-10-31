import { ckb } from "@zimanyar/core";
import { allWords, frequencyOf } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** Not دا: the lessons write دابخە and دابنێ, with ب. */
const PREVERBS = [
  "\u0647\u06d5\u06b5",
  "\u0648\u06d5\u0631",
  "\u062f\u06d5\u0631",
  "\u0695\u0627",
  "\u062a\u06ce",
  "\u067e\u06ce",
  "\u0644\u06ce",
];
const BE = "ب";

/** A verb with a preverb has no ب in the subjunctive or the imperative: هەڵگرە. */
export const preverbB: Rule = {
  id: "ckb.verb.preverb-b",
  check({ sentences }, context) {
    const index = ckb.defaultIndex();
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (index.lookup(word.text).length > 0) continue;
      for (const preverb of PREVERBS) {
        if (!word.text.startsWith(preverb + BE)) continue;
        const candidate = preverb + word.text.slice(preverb.length + BE.length);
        const isTarget = index
          .lookup(candidate)
          .some((form) => form.features["mood"] === "imperative" || form.features["mood"] === "subjunctive");
        // A spelling the corpus prefers to the rule's form is not a mistake worth flagging.
        if (isTarget && frequencyOf(word.text, context) <= frequencyOf(candidate, context)) {
          found.push({ start: word.start, end: word.end, suggestions: [candidate] });
          break;
        }
      }
    }
    return found;
  },
};
