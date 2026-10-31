export { attach, decline, functionWords, type Gender, KmrAnalyzer } from "./morphology.js";
export {
  type KmrOrthographyOptions,
  lower,
  normalize,
  normalizeWord,
  upper,
  validateWord,
} from "./orthography.js";
export { type KmrG2POptions, segments, syllables, textToIpa, toIpa } from "./phonology.js";
export { type AlignmentRecord, type Argument, detectAlignment } from "./syntax.js";
export { textToArabic, toArabic } from "./translit.js";
export {
  conjugate,
  defaultIndex,
  FormIndex,
  guessPresentStem,
  loadCoreVerbs,
  makeVerb,
  pastStemOf,
  type Verb,
  type VerbForm,
} from "./verbs.js";
