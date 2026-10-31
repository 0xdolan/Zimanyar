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
import { ergativeAgreement } from "./kmr/ergative/agreement.js";
import { directAgent } from "./kmr/ergative/direct-agent.js";
import { obliqueObject } from "./kmr/ergative/oblique-object.js";
import { caseAfterPreposition } from "./kmr/morph/case-after-preposition.js";
import { ezafeGender } from "./kmr/morph/ezafe-gender.js";
import { indefiniteEzafeGender } from "./kmr/morph/indef-ezafe-gender.js";
import { presentObjectCase } from "./kmr/morph/present-object-case.js";
import { vowelGlide } from "./kmr/morph/vowel-glide.js";
import { wrongAccent } from "./kmr/orth/accent.js";
import { curlyApostrophe } from "./kmr/orth/apostrophe.js";
import { sentenceCapital } from "./kmr/orth/capital.js";
import { wrongCedilla } from "./kmr/orth/cedilla.js";
import { tripledLetter } from "./kmr/orth/tripled.js";
import { turkishLetter } from "./kmr/orth/turkish-letter.js";
import { unknownWord as kmrUnknownWord } from "./kmr/spell/unknown.js";
import { knownVariant as kmrKnownVariant } from "./kmr/spell/variant.js";
import { futureParticle } from "./kmr/verb/future-particle.js";
import { niNegation } from "./kmr/verb/ni-negation.js";
import { obliqueIntransitiveSubject } from "./kmr/verb/oblique-intransitive-subject.js";
import { prefixContraction } from "./kmr/verb/prefix-contraction.js";
import { presentAgreement } from "./kmr/verb/present-agreement.js";
import { preverbBi } from "./kmr/verb/preverb-bi.js";
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
const KMR_RULES: readonly Rule[] = [
  ergativeAgreement,
  directAgent,
  obliqueObject,
  caseAfterPreposition,
  ezafeGender,
  indefiniteEzafeGender,
  presentObjectCase,
  vowelGlide,
  wrongAccent,
  curlyApostrophe,
  sentenceCapital,
  wrongCedilla,
  tripledLetter,
  turkishLetter,
  kmrUnknownWord,
  kmrKnownVariant,
  futureParticle,
  niNegation,
  obliqueIntransitiveSubject,
  prefixContraction,
  presentAgreement,
  preverbBi,
];

/** The rule that notices another language. It runs alone: such a paragraph is never checked. */
export const NOTICE_RULE: Rule = otherVariety;

/** Every rule that applies to a variety. */
export const rulesFor = (lang: Variety): readonly Rule[] => [
  ...ANY_RULES,
  ...(lang === "ckb" ? CKB_RULES : KMR_RULES),
];

export const allRules = (): readonly Rule[] => [NOTICE_RULE, ...ANY_RULES, ...CKB_RULES, ...KMR_RULES];
