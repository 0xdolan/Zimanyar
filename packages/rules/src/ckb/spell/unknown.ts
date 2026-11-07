import { ckb } from "@zimanyar/core";
import { allWords, isFunctionWord, isLemma, spellingFix } from "../../helpers.js";
import type { RawFinding, Rule, RuleContext } from "../../model.js";
import { isVerbWithObjectClitic } from "../helpers.js";

/** The copula "is" and its forms, written on the word before it: مێزەکەیە. */
const COPULA = /(?:\u06cc\u06d5|\u06d5|\u0645|\u06cc\u062a|\u06cc\u0646|\u0646)$/u;

const isExplained = (word: string, context: RuleContext) =>
  context
    .readings(word)
    .some(
      (reading) =>
        reading.pos === "VERB" || isLemma(reading.lemma, context) || isFunctionWord(reading.lemma, "ckb"),
    );

/** A word the lexicon does not hold and the analyzer cannot explain. */
export const unknownWord: Rule = {
  id: "ckb.spell.unknown",
  check({ sentences }, context) {
    const { lexicon } = context;
    if (lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const normal = ckb.normalizeWord(word.text);
      if (normal.length < 2 || !/^[؀-ۿ‌]+$/u.test(normal) || lexicon.has(normal)) continue;
      const explained =
        isExplained(normal, context) ||
        isVerbWithObjectClitic(normal) ||
        (COPULA.test(normal) && isExplained(normal.replace(COPULA, ""), context));
      if (!explained) {
        found.push({ start: word.start, end: word.end, ...spellingFix(normal, context) });
      }
    }
    return found;
  },
};
