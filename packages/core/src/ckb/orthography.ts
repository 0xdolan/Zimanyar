import {
  ARABIC_DIACRITICS,
  ARABIC_ONLY_LETTERS,
  CKB_CHAR_MAP,
  CKB_FINAL_U_OK,
  CKB_ILLEGAL_SEQUENCES,
  CKB_INITIAL_ALEF_HAMZA,
  CKB_INITIAL_R_RE,
  CKB_INITIAL_VOWEL_RE,
  CKB_LEGACY_FINAL_HEH_RE,
  CKB_LEGACY_HEH_ZWNJ_RE,
  CKB_LETTERS,
  CKB_SEQ_RE,
  CKB_SEQUENCE_MAP,
  CKB_SQUEEZE,
  CKB_STANDARD_OVERRIDES,
  CKB_VALID_RE,
  CKB_VARIANT_SWAPS,
  CKB_ZWNJ_AND_RE,
  CKB_ZWNJ_YI_RE,
  TATWEEL,
  ZWNJ,
} from "../generated/tables.js";
import { cleanZwnj, type DigitTarget, normalizeTextOnce } from "../normalize/shared.js";
import { compareStrings, count, length, pythonRegex, translate, untilStable } from "../python.js";

const AE = "ە"; // ە
const HEH = "ه"; // ه
const HAMZA = "ئ"; // ئ
const VOWEL_LETTERS = "اەێۆ"; // ا ە ێ ۆ

const global = ([source]: readonly (string | undefined)[]) => pythonRegex(source as string, "g");
const SEQUENCES = global(CKB_SEQ_RE);
const SEQUENCE_MAP = CKB_SEQUENCE_MAP as Record<string, string>;
const INITIAL_ALEF_HAMZA = CKB_INITIAL_ALEF_HAMZA.map(
  ([source, to]) => [global([source]), to as string] as const,
);
const SQUEEZE = CKB_SQUEEZE.map(([source, to]) => [global([source]), to as string] as const);
const INITIAL_R = global(CKB_INITIAL_R_RE);
const INITIAL_VOWEL = global(CKB_INITIAL_VOWEL_RE);
const LEGACY_HEH_ZWNJ = global(CKB_LEGACY_HEH_ZWNJ_RE);
const LEGACY_FINAL_HEH = global(CKB_LEGACY_FINAL_HEH_RE);
const VALID = pythonRegex(CKB_VALID_RE[0] as string);
const ZWNJ_YI = global(CKB_ZWNJ_YI_RE);
const ZWNJ_AND = global(CKB_ZWNJ_AND_RE);
const HAMZA_IN_HIATUS = /[اەێۆوی]ئ|ئ[اەێۆوی]/u;

const CHAR_TABLE = new Map(Object.entries(CKB_CHAR_MAP));
const DROP_MARKS = new Map(Array.from(ARABIC_DIACRITICS + TATWEEL, (mark) => [mark, ""] as const));
const PUNCTUATION = new Map([
  [",", "،"],
  [";", "؛"],
  ["?", "؟"],
  ["٪", "%"],
]);
const arabicOnly = new Set(ARABIC_ONLY_LETTERS);
const letters = new Set(CKB_LETTERS);

/** No U+06D5 at all but heh + ZWNJ or many final hehs, or more heh + ZWNJ than U+06D5. */
export function isLegacyEncoded(text: string): boolean {
  const hehZwnj = HEH + ZWNJ;
  if (text.includes(AE)) return count(text, hehZwnj) > count(text, AE);
  return text.includes(hehZwnj) || Array.from(text.matchAll(LEGACY_FINAL_HEH)).length >= 3;
}

export interface CkbOrthographyOptions {
  digits?: DigitTarget;
  kurdishPunctuation?: boolean;
  legacy?: "auto" | "yes" | "no";
  fixInitialR?: boolean;
  addInitialHamza?: boolean;
}

/** One pass of normalize: exactly what zimankit does, and what the parity tests compare. */
export function normalizeOnce(input: string, options: CkbOrthographyOptions = {}): string {
  const {
    digits = "arabic-indic",
    kurdishPunctuation = true,
    legacy = "auto",
    fixInitialR = true,
    addInitialHamza = true,
  } = options;
  let text = normalizeTextOnce(input, { digits });
  text = text.replace(SEQUENCES, (sequence) => SEQUENCE_MAP[sequence] as string);
  for (const [pattern, to] of INITIAL_ALEF_HAMZA) text = text.replace(pattern, to);
  text = translate(text, CHAR_TABLE);
  const isLegacy = legacy === "yes" || (legacy === "auto" && isLegacyEncoded(text));
  // Heh + ZWNJ is the legacy spelling of ae in every text, legacy or not.
  text = text.replace(LEGACY_HEH_ZWNJ, AE);
  if (isLegacy) text = text.replace(LEGACY_FINAL_HEH, AE);
  text = translate(text, DROP_MARKS);
  if (fixInitialR) text = text.replace(INITIAL_R, "ڕ");
  if (addInitialHamza) text = text.replace(INITIAL_VOWEL, `${HAMZA}$1`);
  for (const [pattern, to] of SQUEEZE) text = text.replace(pattern, to);
  if (kurdishPunctuation) text = translate(text, PUNCTUATION);
  text = text.replace(ZWNJ_YI, "یی"); // سپی‌یە -> سپییە
  text = text.replace(ZWNJ_AND, " و"); // من‌و تۆ -> من و تۆ
  return cleanZwnj(text);
}

/** Text in standard Central Kurdish Unicode orthography. */
export function normalize(input: string, options: CkbOrthographyOptions = {}): string {
  return untilStable(input, (text) => normalizeOnce(text, options));
}

/** Normalize one token: no punctuation or digit handling, and no guessing at legacy text. */
export function normalizeWord(word: string): string {
  return normalize(word, { digits: "keep", kurdishPunctuation: false, legacy: "no" });
}

/**
 * What makes a word impossible; the lexicon builder rejects on these only. Corpus evidence decides what is
 * recognised, so a common non-standard spelling stays in the lexicon.
 */
export function structuralProblems(word: string): string[] {
  if (word === "") return ["empty"];
  const problems: string[] = [];
  const characters = Array.from(word);
  if (characters.some((character) => arabicOnly.has(character))) problems.push("arabic-only letter");
  if (!VALID.test(word)) {
    const bad = [...new Set(characters.filter((c) => !letters.has(c) && c !== ZWNJ))].sort(compareStrings);
    const names = bad.map(
      (c) => `U+${(c.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")}`,
    );
    problems.push(`non-Kurdish character(s): ${names.join(" ")}`);
  }
  for (const [sequence, why] of CKB_ILLEGAL_SEQUENCES) {
    if (word.includes(sequence as string)) problems.push(why as string);
  }
  const first = characters[0] as string;
  if (VOWEL_LETTERS.includes(first)) problems.push("initial vowel without ئ");
  if (first === "ر") problems.push("initial ر should be ڕ");
  if (characters.slice(1).includes(HAMZA) && !HAMZA_IN_HIATUS.test(word)) {
    problems.push("medial hamza outside a vowel hiatus");
  }
  if (
    characters.length > 1 &&
    word.endsWith(HEH) &&
    VOWEL_LETTERS.includes(characters.at(-2) as string) &&
    !word.includes(AE)
  ) {
    problems.push("possible legacy heh for ae");
  }
  return problems;
}

const finalUOk = new Set(CKB_FINAL_U_OK);
const OVERRIDES = CKB_STANDARD_OVERRIDES as Record<string, string>;

/** What is wrong with a word's spelling against the written standard; an empty list means nothing is. */
export function validateWord(word: string): string[] {
  const problems = structuralProblems(word);
  if (word === "") return problems;
  if (word[0] === "ڵ") problems.push("initial ڵ");
  if (length(word) > 2 && word.startsWith("وو"))
    problems.push("initial وو: write و, the bizroke follows (وشە, ورچ)");
  if (
    length(word) > 1 &&
    !finalUOk.has(word) &&
    word.endsWith("و") &&
    !`اەۆێوی${ZWNJ}`.includes(word.at(-2) as string)
  ) {
    problems.push("final و after a consonant: write وو (چوو, مێژوو), or a separate و 'and'");
  }
  if (word.includes(`ی${ZWNJ}ی`)) problems.push("ZWNJ inside یی: write it solid (سپییە, چییە)");
  if (word.includes("یییی")) problems.push("more than three ی");
  const standard = OVERRIDES[word];
  if (standard !== undefined) problems.push(`the standard spelling is ${standard}`);
  return problems;
}

const WAW = "و";
const DOUBLE_WAW = WAW + WAW;
const GEMINATING = "مننلت"; // م ن ن ل ت
const BEFORE_GEMINATE = "ەاێۆ"; // ە ا ێ ۆ

/** Respellings of a word by toggling letters that writers confuse, sorted. */
export function spellingVariants(word: string, maxVariants = 64): string[] {
  const variants = new Set([word]);
  for (const [a, b] of CKB_VARIANT_SWAPS as [string, string][]) {
    const found = new Set<string>();
    for (const variant of variants) {
      for (let i = 0; i < variant.length; i++) {
        if (
          variant.startsWith(a, i) &&
          !(a === WAW && b === DOUBLE_WAW && variant.startsWith(DOUBLE_WAW, i))
        ) {
          found.add(variant.slice(0, i) + b + variant.slice(i + a.length));
        }
        if (variant.startsWith(b, i) && b !== DOUBLE_WAW) {
          found.add(variant.slice(0, i) + a + variant.slice(i + b.length));
        }
      }
    }
    for (const variant of found) variants.add(variant);
    if (variants.size > maxVariants) break;
  }
  if (word.includes(ZWNJ)) variants.add(word.replaceAll(ZWNJ, ""));
  for (let i = 1; i < length(word); i++) {
    const current = word[i] as string;
    if (
      GEMINATING.includes(current) &&
      BEFORE_GEMINATE.includes(word[i - 1] as string) &&
      current !== word[i + 1]
    ) {
      variants.add(word.slice(0, i + 1) + current + word.slice(i + 1));
    }
  }
  variants.delete(word);
  return [...variants].sort(compareStrings).slice(0, maxVariants);
}
