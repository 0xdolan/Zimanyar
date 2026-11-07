export { CKB_CHAR_MAP, CKB_HIDDEN_FORMS as HIDDEN_FORMS } from "../generated/tables.js";
export {
  CkbAnalyzer,
  decline,
  endsWithVowel,
  functionWords,
  splitDefinite,
  splitEnclitic,
} from "./morphology.js";
export {
  type CkbOrthographyOptions,
  isLegacyEncoded,
  normalize,
  normalizeWord,
  spellingVariants,
  structuralProblems,
  validateWord,
} from "./orthography.js";
export {
  type G2POptions,
  type LatinStyle,
  segments,
  syllables,
  textToIpa,
  toIpa,
  toLatin,
} from "./phonology.js";
export {
  baseInfinitive,
  conjugate,
  defaultIndex,
  FormIndex,
  guessPresentStem,
  loadCoreVerbs,
  makeVerb,
  PERSONS,
  pastStemOf,
  standardSpelling,
  type Verb,
  type VerbForm,
} from "./verbs.js";
