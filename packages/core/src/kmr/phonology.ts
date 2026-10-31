import { KMR_PHON_ASPIRABLE, KMR_PHON_CONSONANTS, KMR_PHON_VOWELS } from "../generated/tables.js";
import { type Segment, syllabify } from "../phonology/core.js";
import { tokenize } from "../tokenize.js";
import { lower, normalizeWord } from "./orthography.js";

const vowels = new Map(Object.entries(KMR_PHON_VOWELS));
const consonants = new Map(Object.entries(KMR_PHON_CONSONANTS));
const aspirable = new Set(KMR_PHON_ASPIRABLE);

export interface KmrG2POptions {
  /** Aspiration, ŋ before velars, and ɫ for ll. */
  narrow?: boolean;
  /** Render the short i of a final closed syllable as a reduced vowel: dîtin. */
  reducedSuffixI?: boolean;
  reducedSymbol?: string;
  syllableDots?: boolean;
}

/** While parsing, C* marks a stop that an apostrophe made unaspirated. */
type Draft = [symbol: string, kind: "C" | "V" | "C*"];

const SHORT_I = "ɪ";
const ASPIRATED = new Set(["p", "t", "k", "tʃ"]);
const VELARS = new Set(["k", "kʰ", "ɡ", "q"]);

/** The phoneme segments of a word. */
export function segments(word: string, options: KmrG2POptions = {}, normalized = false): Segment[] {
  const { narrow = false, reducedSuffixI = true, reducedSymbol = "ɯ" } = options;
  const w = normalized ? lower(word) : normalizeWord(word);
  const draft: Draft[] = [];
  let i = 0;
  while (i < w.length) {
    const character = w[i] as string;
    const next = w[i + 1];
    if (character === "x" && next === "w") {
      draft.push(["xʷ", "C"]);
      i += 2;
      continue;
    }
    if (character === "r" && next === "r") {
      draft.push(["r", "C"]);
      i += 2;
      continue;
    }
    if (character === "l" && next === "l" && narrow) {
      draft.push(["ɫ", "C"]);
      i += 2;
      continue;
    }
    if (character === "'") {
      if (i === 0) {
        draft.push(["ʕ", "C"]);
      } else if (narrow && aspirable.has(w[i - 1] as string)) {
        // p' t' k' ç' are unaspirated; any other apostrophe is a morpheme boundary, not a sound.
        const last = draft.at(-1) as Draft;
        last[1] = "C*";
      }
      i++;
      continue;
    }
    const vowel = vowels.get(character);
    const consonant = consonants.get(character);
    if (vowel !== undefined) draft.push([vowel, "V"]);
    else if (consonant !== undefined) draft.push([character === "r" && i === 0 ? "r" : consonant, "C"]);
    i++;
  }
  // The reduced suffix vowel: the last vowel is short i, in a closed final syllable.
  const vowelAt = draft.flatMap(([, kind], k) => (kind === "V" ? [k] : []));
  const lastVowel = vowelAt.at(-1) as number;
  if (
    reducedSuffixI &&
    vowelAt.length >= 2 &&
    (draft[lastVowel] as Draft)[0] === SHORT_I &&
    lastVowel < draft.length - 1
  ) {
    draft[lastVowel] = [reducedSymbol, "V"];
  }
  return draft.map(([symbol, kind], k): Segment => {
    let out = symbol;
    if (narrow) {
      if (kind === "C" && ASPIRATED.has(symbol)) out = `${symbol}ʰ`;
      const following = draft[k + 1];
      if (symbol === "n" && following !== undefined && VELARS.has(following[0])) out = "ŋ";
    }
    return [out, kind === "C*" ? "C" : kind];
  });
}

/** IPA for a word. Broad unless options.narrow is set. */
export function toIpa(word: string, options: KmrG2POptions = {}, marked = false): string {
  const { narrow = false, syllableDots = false } = options;
  const parts = segments(word, options);
  const body = syllableDots
    ? syllabify(parts)
        .map((syllable) => syllable.map(([symbol]) => symbol).join(""))
        .join(".")
    : parts.map(([symbol]) => symbol).join("");
  if (!marked) return body;
  return narrow ? `[${body}]` : `/${body}/`;
}

export function syllables(word: string): string[] {
  return syllabify(segments(word)).map((syllable) => syllable.map(([symbol]) => symbol).join(""));
}

export function textToIpa(text: string, options: KmrG2POptions = {}): string {
  return tokenize(text)
    .map((token) => (token.kind === "word" ? toIpa(token.text, options) : token.text))
    .join(" ");
}
