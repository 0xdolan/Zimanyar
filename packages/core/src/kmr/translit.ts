import { KMR_TRANSLIT_MAP, KMR_VOWELS } from "../generated/tables.js";
import { tokenize } from "../tokenize.js";
import { lower } from "./orthography.js";

const map = new Map(Object.entries(KMR_TRANSLIT_MAP));
const vowels = new Set(KMR_VOWELS);
const HAMZA = "ئ"; // ئ

/** Kurmanji in the Arabic-based script: long vowels as letters, and short i unwritten. */
export function toArabic(word: string): string {
  const lowered = lower(word);
  if (lowered === "û") return "و"; // the conjunction "and"
  // An inner apostrophe is a suffix boundary.
  const w = lowered === "" ? lowered : (lowered[0] as string) + lowered.slice(1).replaceAll("'", "");
  let out = "";
  let i = 0;
  while (i < w.length) {
    const character = w[i] as string;
    const next = w[i + 1];
    const letter = map.get(character);
    if (i === 0 && vowels.has(character)) {
      out += HAMZA + (character === "i" ? "" : (letter as string));
      i++;
    } else if (character === "r" && (i === 0 || next === "r")) {
      out += "ڕ";
      i += next === "r" ? 2 : 1;
    } else if (character === "l" && next === "l") {
      out += "ڵ";
      i += 2;
    } else if (vowels.has(character) && i > 0 && vowels.has(w[i - 1] as string) && character !== "i") {
      out += HAMZA + (letter as string); // vowel hiatus is written with ئ
      i++;
    } else {
      out += letter ?? character;
      i++;
    }
  }
  return out.replaceAll("ەە", "ە");
}

export function textToArabic(text: string): string {
  return tokenize(text)
    .map((token) => (token.kind === "word" ? toArabic(token.text) : token.text))
    .join(" ");
}
