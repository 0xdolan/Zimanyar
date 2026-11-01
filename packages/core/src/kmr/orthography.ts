import {
  KMR_APOS_EDGE_RE,
  KMR_CHAR_MAP,
  KMR_FOREIGN_LETTERS,
  KMR_LETTERS,
  KMR_STANDARD_OVERRIDES,
  KMR_VALID_RE,
} from "../generated/tables.js";
import { normalizeTextOnce } from "../normalize/shared.js";
import { compareStrings, length, pythonRegex, translate, untilStable } from "../python.js";

const CHAR_TABLE = new Map(Object.entries(KMR_CHAR_MAP));
const TO_LOWER = new Map([
  ["İ", "i"],
  ["I", "i"],
  ["Î", "î"],
  ["Ê", "ê"],
  ["Û", "û"],
  ["Ş", "ş"],
  ["Ç", "ç"],
]);
const TO_UPPER = new Map([
  ["i", "I"],
  ["î", "Î"],
  ["ê", "Ê"],
  ["û", "Û"],
  ["ş", "Ş"],
  ["ç", "Ç"],
]);
const APOSTROPHE_EDGE = pythonRegex(KMR_APOS_EDGE_RE[0] as string, "g");
const VALID = pythonRegex(KMR_VALID_RE[0] as string);
const foreignLetters = new Set(KMR_FOREIGN_LETTERS);
const letters = new Set(KMR_LETTERS);

const TRIPLED = pythonRegex("(.)\\1\\1");
const THREE_VOWELS = /[aeêiîouû]{3,}/u;
const FOUR_CONSONANTS = /[bcçdfghjklmnpqrsştvxzw]{4,}/u;
const ANY_VOWEL = /[aeêiîouû]/u;
const DOUBLED_VOWEL = /(?:^|[^aeêiîouû])(?:ee|êê|îî|ûû)/u;

/** Kurdish lowercase, never the Turkish dotted and dotless mapping. */
export function lower(text: string): string {
  return translate(text, TO_LOWER).toLowerCase();
}

export function upper(text: string): string {
  return translate(text, TO_UPPER).toUpperCase();
}

export interface KmrOrthographyOptions {
  lowercase?: boolean;
  /** HDP'yê; when false, HDPyê. */
  keepApostrophe?: boolean;
}

/** One pass of normalize: exactly what zimankit does, and what the parity tests compare. */
export function normalizeOnce(input: string, options: KmrOrthographyOptions = {}): string {
  const { lowercase = false, keepApostrophe = true } = options;
  let text = translate(normalizeTextOnce(input, { digits: "latin" }), CHAR_TABLE);
  if (text.includes("'")) text = text.replace(APOSTROPHE_EDGE, "");
  if (!keepApostrophe) text = text.replaceAll("'", "");
  return lowercase ? lower(text) : text;
}

/** Text in the Hawar alphabet, with look-alike letters folded. */
export function normalize(input: string, options: KmrOrthographyOptions = {}): string {
  return untilStable(input, (text) => normalizeOnce(text, options));
}

export function normalizeWord(word: string, lowercase = true): string {
  return normalize(word, { lowercase });
}

/** What is wrong with a word's spelling; an empty list means it is valid. */
export function validateWord(word: string): string[] {
  if (word === "") return ["empty"];
  const problems: string[] = [];
  const w = lower(word);
  const characters = Array.from(w);
  const standard = (KMR_STANDARD_OVERRIDES as Record<string, string>)[w];
  if (standard !== undefined) problems.push(`the standard spelling is ${standard}`);
  const foreign = [...new Set(characters.filter((c) => foreignLetters.has(c)))].sort(compareStrings);
  if (foreign.length > 0) problems.push(`foreign letter(s): ${foreign.join("")}`);
  if (!VALID.test(w)) {
    const bad = [...new Set(characters.filter((c) => !letters.has(c) && c !== "'"))].sort(compareStrings);
    if (bad.length > 0) problems.push(`non-Hawar character(s): ${bad.join("")}`);
  }
  if (TRIPLED.test(w)) problems.push("tripled letter");
  if (THREE_VOWELS.test(w)) problems.push("three vowels in a row");
  if (FOUR_CONSONANTS.test(w)) problems.push("four consonants in a row");
  if (!ANY_VOWEL.test(w) && length(w) > 2) problems.push("no vowel");
  if (DOUBLED_VOWEL.test(w)) problems.push("doubled vowel");
  return problems;
}
