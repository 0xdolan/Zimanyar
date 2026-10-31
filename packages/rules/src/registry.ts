import { otherVariety } from "./any/lid/other-variety.js";
import { repeatedWord } from "./any/repeat/word.js";
import { mixedScript } from "./any/script/mixed.js";
import { spacePunctuation } from "./any/space/punctuation.js";
import { definiteAdjectiveOrder } from "./ckb/morph/definite-adjective-order.js";
import { definiteAllomorph } from "./ckb/morph/definite-allomorph.js";
import { ezafeMissing } from "./ckb/morph/ezafe-missing.js";
import { indefiniteAllomorph } from "./ckb/morph/indef-allomorph.js";
import { pluralAfterNumber } from "./ckb/morph/plural-after-number.js";
import { arabicCodepoint } from "./ckb/orth/arabic-codepoint.js";
import { arabicOnlyLetter } from "./ckb/orth/arabic-only-letter.js";
import { digitsPunct } from "./ckb/orth/digits-punct.js";
import { doubledLetter } from "./ckb/orth/doubled-letter.js";
import { initialR } from "./ckb/orth/initial-r.js";
import { initialVowel } from "./ckb/orth/initial-vowel.js";
import { legacyHeh } from "./ckb/orth/legacy-heh.js";
import { missingMark } from "./ckb/spell/missing-mark.js";
import { unknownWord } from "./ckb/spell/unknown.js";
import { knownVariant } from "./ckb/spell/variant.js";
import { verbFinal } from "./ckb/syntax/verb-final.js";
import { agentDoubled } from "./ckb/verb/agent-doubled.js";
import { agentMisplaced } from "./ckb/verb/agent-misplaced.js";
import { agentMissing } from "./ckb/verb/agent-missing.js";
import { agentOnIntransitive } from "./ckb/verb/agent-on-intransitive.js";
import { irregularForm } from "./ckb/verb/irregular.js";
import { negationClitic } from "./ckb/verb/negation-clitic.js";
import { preverbB } from "./ckb/verb/preverb-b.js";
import type { Rule, Variety } from "./model.js";

const ANY_RULES: readonly Rule[] = [mixedScript, spacePunctuation, repeatedWord];
const CKB_RULES: readonly Rule[] = [
  definiteAdjectiveOrder,
  definiteAllomorph,
  ezafeMissing,
  indefiniteAllomorph,
  pluralAfterNumber,
  arabicCodepoint,
  arabicOnlyLetter,
  digitsPunct,
  doubledLetter,
  initialR,
  initialVowel,
  legacyHeh,
  missingMark,
  unknownWord,
  knownVariant,
  verbFinal,
  agentDoubled,
  agentMisplaced,
  agentMissing,
  agentOnIntransitive,
  irregularForm,
  negationClitic,
  preverbB,
];
const KMR_RULES: readonly Rule[] = [];

/** The rule that notices another language. It runs alone: such a paragraph is never checked. */
export const NOTICE_RULE: Rule = otherVariety;

/** Every rule that applies to a variety. */
export const rulesFor = (lang: Variety): readonly Rule[] => [
  ...ANY_RULES,
  ...(lang === "ckb" ? CKB_RULES : KMR_RULES),
];

export const allRules = (): readonly Rule[] => [NOTICE_RULE, ...ANY_RULES, ...CKB_RULES, ...KMR_RULES];
