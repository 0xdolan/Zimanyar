import { otherVariety } from "./any/lid/other-variety.js";
import { repeatedWord } from "./any/repeat/word.js";
import { mixedScript } from "./any/script/mixed.js";
import { spacePunctuation } from "./any/space/punctuation.js";
import type { Rule, Variety } from "./model.js";

const ANY_RULES: readonly Rule[] = [mixedScript, spacePunctuation, repeatedWord];
const CKB_RULES: readonly Rule[] = [];
const KMR_RULES: readonly Rule[] = [];

/** The rule that notices another language. It runs alone: such a paragraph is never checked. */
export const NOTICE_RULE: Rule = otherVariety;

/** Every rule that applies to a variety. */
export const rulesFor = (lang: Variety): readonly Rule[] => [
  ...ANY_RULES,
  ...(lang === "ckb" ? CKB_RULES : KMR_RULES),
];

export const allRules = (): readonly Rule[] => [NOTICE_RULE, ...ANY_RULES, ...CKB_RULES, ...KMR_RULES];
