import { CkbAnalyzer, functionWords as ckbFunctionWords } from "./ckb/morphology.js";
import { normalize as normalizeCkb } from "./ckb/orthography.js";
import { toIpa as ckbToIpa } from "./ckb/phonology.js";
import { KmrAnalyzer, functionWords as kmrFunctionWords } from "./kmr/morphology.js";
import { normalize as normalizeKmr } from "./kmr/orthography.js";
import { toIpa as kmrToIpa } from "./kmr/phonology.js";
import type { Analysis } from "./schema.js";
import { detectScript } from "./text.js";

export type Variety = "ckb" | "kmr";

/** Without a stated variety, Arabic script means Sorani and anything else Kurmanji. */
const varietyOf = (text: string, lang?: Variety): Variety =>
  lang ?? (detectScript(text) === "arabic" ? "ckb" : "kmr");

export function normalize(text: string, lang?: Variety): string {
  return varietyOf(text, lang) === "ckb" ? normalizeCkb(text) : normalizeKmr(text);
}

export function toIpa(word: string, lang?: Variety): string {
  return varietyOf(word, lang) === "ckb" ? ckbToIpa(word) : kmrToIpa(word);
}

const analyzers: { ckb?: CkbAnalyzer; kmr?: KmrAnalyzer } = {};

/** Analyze a word without a lexicon. To use one, build an analyzer with lexiconAdapter. */
export function analyze(word: string, lang?: Variety): Analysis[] {
  if (varietyOf(word, lang) === "ckb") {
    analyzers.ckb ??= new CkbAnalyzer();
    return analyzers.ckb.analyze(word);
  }
  analyzers.kmr ??= new KmrAnalyzer();
  return analyzers.kmr.analyze(word);
}

/** The closed-class words of a variety: pronouns, prepositions, numbers and so on. */
export const functionWordsFor = (lang: Variety) => (lang === "ckb" ? ckbFunctionWords() : kmrFunctionWords());
