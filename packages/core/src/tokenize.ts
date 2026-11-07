import { HYPHEN_WORD_RE, SENTENCE_END_RE, TOKEN_RE, WORD_RE } from "./generated/tables.js";
import { isSpace, pythonRegex, strip } from "./python.js";

export type TokenKind = "word" | "number" | "punct";

export interface Token {
  text: string;
  kind: TokenKind;
  /** UTF-16 offsets into the text. */
  start: number;
  end: number;
}

const TOKEN = pythonRegex(TOKEN_RE[0] as string, "y");
const WORD = pythonRegex(WORD_RE[0] as string, "g");
const HYPHEN_WORD = pythonRegex(HYPHEN_WORD_RE[0] as string, "g");
const SENTENCE_END = pythonRegex(SENTENCE_END_RE[0] as string, "g");

/**
 * Split a text into word, number and punctuation tokens. A ZWNJ never splits a word; an
 * apostrophe between letters is kept; hyphenated compounds split unless keepHyphen is set.
 */
export function tokenize(text: string, keepHyphen = false): Token[] {
  const tokens: Token[] = [];
  const hyphenated = new Map<number, string>();
  if (keepHyphen) {
    for (const match of text.matchAll(HYPHEN_WORD)) hyphenated.set(match.index, match[0]);
  }
  let position = 0;
  while (position < text.length) {
    const character = String.fromCodePoint(text.codePointAt(position) as number);
    if (isSpace(character)) {
      position += character.length;
      continue;
    }
    const compound = hyphenated.get(position);
    if (compound !== undefined) {
      tokens.push({ text: compound, kind: "word", start: position, end: position + compound.length });
      position += compound.length;
      continue;
    }
    TOKEN.lastIndex = position;
    // The pattern ends in "any character that is not a space", so it always matches here.
    const match = TOKEN.exec(text) as RegExpExecArray;
    const groups = match.groups as Record<string, string | undefined>;
    const kind: TokenKind =
      groups["word"] !== undefined ? "word" : groups["number"] !== undefined ? "number" : "punct";
    tokens.push({ text: match[0], kind, start: position, end: position + match[0].length });
    position += match[0].length;
  }
  return tokens;
}

/** Only the word tokens of a text. */
export function words(text: string): string[] {
  return Array.from(text.matchAll(WORD), (match) => match[0]);
}

const CLOSERS = '»”")]';
// د. سۆران, ی. ن. ک.
const ABBREVIATION = pythonRegex("(?:^|[\\s(«])[\u0620-\u06ff]\\.$");

/** A rough sentence split on terminal punctuation and newlines. A one-letter abbreviation does not end one. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    if (!match[0].includes("\n") && ABBREVIATION.test(text.slice(start, match.index))) continue;
    let keep = 0;
    while (keep < match[0].length && CLOSERS.includes(match[0][keep] as string)) keep++;
    const sentence = strip(text.slice(start, match.index + keep));
    if (sentence !== "") out.push(sentence);
    start = match.index + match[0].length;
  }
  const tail = strip(text.slice(start));
  return tail === "" ? out : [...out, tail];
}
