import { ckb, kmr, tokenize } from "@zimanyar/core";

const isArabic = (text: string): boolean => /\p{Script=Arabic}/u.test(text);

/** Keep everything between the words, and change the words. */
function mapWords(text: string, change: (word: string) => string): string {
  let out = "";
  let at = 0;
  for (const token of tokenize(text)) {
    if (token.kind !== "word") continue;
    out += text.slice(at, token.start) + change(token.text);
    at = token.end;
  }
  return out + text.slice(at);
}

const TO_LATIN_MARKS: Readonly<Record<string, string>> = { "،": ",", "؛": ";", "؟": "?" };

/** Text in the other script: Sorani in Arabic script to Latin, Kurmanji in Latin to Arabic script. */
export function transliterate(text: string): string {
  if (isArabic(text)) {
    return Array.from(
      mapWords(text, ckb.toLatin),
      (character) => TO_LATIN_MARKS[character] ?? character,
    ).join("");
  }
  return kmr.textToArabic(text);
}

/** The pronunciation of a text, between slashes. */
export function pronounce(text: string): string {
  return `/${isArabic(text) ? ckb.textToIpa(text) : kmr.textToIpa(text)}/`;
}
