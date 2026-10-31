import { CKB_CONSONANTS, CKB_IPA_TO_LATIN, CKB_LATIN_STYLES, CKB_VOWELS } from "../generated/tables.js";
import { breakClusters, type Segment, syllabify } from "../phonology/core.js";
import { tokenize } from "../tokenize.js";
import { normalizeWord } from "./orthography.js";

const consonants = new Map(Object.entries(CKB_CONSONANTS));
const vowels = new Map(Object.entries(CKB_VOWELS));
const ipaToLatin = new Map(Object.entries(CKB_IPA_TO_LATIN));
const styles = CKB_LATIN_STYLES as Record<string, Record<string, string>>;

const WAW = "و"; // و
const YEH = "ی"; // ی
const REH = "ر"; // ر
const HAMZA = "ئ"; // ئ
const ZWNJ = "‌";

export interface G2POptions {
  /** The symbol for the bizroke, the unwritten short vowel. */
  epenthetic?: string;
  /** Wrap inferred vowels in parentheses. */
  markEpenthesis?: boolean;
  /** Render a word-initial ئ as a glottal stop. */
  glottalOnset?: boolean;
  /** Add a glide between two vowels. */
  hiatusGlides?: boolean;
  syllableDots?: boolean;
}

function graphemes(word: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < word.length) {
    const character = word[i] as string;
    if (character === ZWNJ) {
      i++;
    } else if ((character === WAW || character === YEH) && word[i + 1] === character) {
      out.push(character + character);
      i += 2;
    } else {
      out.push(character);
      i++;
    }
  }
  return out;
}

/** Turn graphemes into segments. و and ی are decided by context, as consonants or vowels. */
function resolve(graphemeList: readonly string[]): Segment[] {
  if (graphemeList.length === 1 && graphemeList[0] === WAW) return [["u", "V"]];
  const segments: Segment[] = [];
  graphemeList.forEach((grapheme, i) => {
    const previous = segments.at(-1);
    const previousIsVowel = previous !== undefined && previous[1] === "V";
    const next = graphemeList[i + 1];
    const nextIsVowel = next !== undefined && vowels.has(next);
    const vowel = vowels.get(grapheme);
    const consonant = consonants.get(grapheme);
    if (vowel !== undefined) {
      segments.push([vowel, "V"]);
    } else if (consonant !== undefined) {
      segments.push([grapheme === REH && i === 0 ? "r" : consonant, "C"]);
    } else if (grapheme === WAW + WAW) {
      if (previousIsVowel) segments.push(["w", "C"]);
      segments.push(["uː", "V"]);
    } else if (grapheme === YEH + YEH) {
      if (previousIsVowel) segments.push(["j", "C"]);
      segments.push(["iː", "V"]);
    } else if (grapheme === WAW) {
      segments.push(i === 0 || previousIsVowel || nextIsVowel ? ["w", "C"] : ["u", "V"]);
    } else if (grapheme === YEH) {
      if (i === 0) {
        segments.push(nextIsVowel || next === WAW || next === WAW + WAW ? ["j", "C"] : ["iː", "V"]);
      } else {
        segments.push(previousIsVowel || nextIsVowel ? ["j", "C"] : ["iː", "V"]);
      }
    }
    // Anything else, such as digits and foreign letters, is skipped.
  });
  return segments;
}

function hiatus(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  segments.forEach((segment, i) => {
    out.push(segment);
    if (segment[1] === "V" && segments[i + 1]?.[1] === "V") {
      if (segment[0] === "uː" || segment[0] === "u") out.push(["w", "C"]);
      else if (segment[0] === "iː") out.push(["j", "C"]);
    }
  });
  return out;
}

/** The phoneme segments of a word, with inferred vowels marked as kind E. */
export function segments(word: string, options: G2POptions = {}, normalized = false): Segment[] {
  const { epenthetic = "ɯ", glottalOnset = true, hiatusGlides = true } = options;
  let parsed = graphemes(normalized ? word : normalizeWord(word));
  // Word-initial ئ + consonant: the hamza itself spells the bizroke.
  let lead: Segment[] = [];
  const second = parsed[1];
  if (parsed[0] === HAMZA && second !== undefined && consonants.has(second)) {
    lead = [
      ["ʔ", "C"],
      [epenthetic, "E"],
    ];
    parsed = parsed.slice(1);
  }
  let resolved = resolve(parsed);
  if (hiatusGlides) resolved = hiatus(resolved);
  const repaired =
    lead.length > 0
      ? [...lead, ...breakClusters([["", "V"], ...resolved], epenthetic).slice(1)]
      : breakClusters(resolved, epenthetic);
  const first = repaired[0];
  if (!glottalOnset && first !== undefined && first[0] === "ʔ" && first[1] === "C") return repaired.slice(1);
  return repaired;
}

const render = ([symbol, kind]: Segment, mark: boolean) => (kind === "E" && mark ? `(${symbol})` : symbol);

/** Broad phonemic IPA for a word. */
export function toIpa(word: string, options: G2POptions = {}, slashes = false): string {
  const { markEpenthesis = true, syllableDots = false } = options;
  const parts = segments(word, options);
  const body = syllableDots
    ? syllabify(parts)
        .map((syllable) => syllable.map((segment) => render(segment, markEpenthesis)).join(""))
        .join(".")
    : parts.map((segment) => render(segment, markEpenthesis)).join("");
  return slashes ? `/${body}/` : body;
}

/** The syllables of a word in IPA, with the inferred vowel unmarked. */
export function syllables(word: string): string[] {
  return syllabify(segments(word, { markEpenthesis: false })).map((syllable) =>
    syllable.map(([symbol]) => symbol).join(""),
  );
}

export type LatinStyle = "hawar" | "accented";

/** Kurdish-Latin transliteration; the bizroke is written as i. */
export function toLatin(word: string, style: LatinStyle = "hawar"): string {
  const overrides = styles[style] ?? {};
  return segments(word, { markEpenthesis: false })
    .map(([symbol], i) => {
      if (symbol === "ʔ") return i === 0 ? "" : "'";
      if (symbol === "r" && i === 0) return "r";
      return overrides[symbol] ?? ipaToLatin.get(symbol) ?? symbol;
    })
    .join("");
}

export function textToIpa(text: string, options: G2POptions = {}): string {
  return tokenize(text)
    .map((token) => (token.kind === "word" ? toIpa(token.text, options) : token.text))
    .join(" ");
}
