export { analyze, normalize, toIpa } from "./api.js";
export * as ckb from "./ckb/index.js";
export { type CompleteOptions, type Completion, complete } from "./complete.js";
export * as kmr from "./kmr/index.js";
export { lexiconAdapter } from "./lexicon-adapter.js";
export { identify, isLang, type LidLang, type LidResult } from "./lid.js";
export { cleanZwnj, type DigitTarget, type NormalizeOptions, normalizeText } from "./normalize/shared.js";
export {
  breakClusters,
  legalCoda,
  legalOnset,
  type Segment,
  sonority,
  syllabify,
} from "./phonology/core.js";
export {
  type Analysis,
  emptyLexicon,
  type LexiconLike,
  SimpleLexicon,
  segmentation,
} from "./schema.js";
export { type Suggestion, type SuggestOptions, suggest } from "./spelling.js";
export {
  CKB_LETTER_CLASS,
  charScript,
  damerauLevenshtein,
  detectScript,
  KMR_LETTER_CLASS,
  levenshtein,
  PATTERNS,
  type PatternName,
  pattern,
  type Script,
  weightedDistance,
} from "./text.js";
export { sentences, type Token, type TokenKind, tokenize, words } from "./tokenize.js";
