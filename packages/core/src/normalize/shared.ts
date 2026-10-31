import {
  ARABIC_INDIC_DIGITS,
  BIDI_CONTROLS,
  BLANK_LINES_RE,
  EMAIL_RE,
  EMOJI_RE,
  HSPACE_RE,
  LATIN_DIGITS,
  MENTION_RE,
  MICRO_SPACES,
  PERSIAN_DIGITS,
  URL_RE,
  WIDE_SPACES,
  ZWJ,
  ZWNJ,
  ZWNJ_AFTER_NONJOINING_RE,
  ZWNJ_EDGE_RE,
  ZWNJ_RUN_RE,
} from "../generated/tables.js";
import { pythonRegex, strip, translate } from "../python.js";

export type DigitTarget = "keep" | "latin" | "arabic-indic";

export interface NormalizeOptions {
  digits?: DigitTarget;
  stripUrls?: boolean;
  stripEmails?: boolean;
  stripMentions?: boolean;
  stripEmoji?: boolean;
  collapseBlankLines?: boolean;
}

const compile = ([source, flags]: readonly string[]) => pythonRegex(source as string, `g${flags}`);
const URL = compile(URL_RE);
const EMAIL = compile(EMAIL_RE);
const MENTION = compile(MENTION_RE);
const EMOJI = compile(EMOJI_RE);
const HSPACE = compile(HSPACE_RE);
const BLANK_LINES = compile(BLANK_LINES_RE);
const ZWNJ_EDGE = compile(ZWNJ_EDGE_RE);
const ZWNJ_RUN = compile(ZWNJ_RUN_RE);
const ZWNJ_AFTER_NONJOINING = compile(ZWNJ_AFTER_NONJOINING_RE);

const each = (characters: string, to: string) =>
  new Map(Array.from(characters, (character) => [character, to] as const));
const pairs = (from: string, to: string) => {
  const target = Array.from(to);
  return Array.from(from, (character, i) => [character, target[i] as string] as const);
};
const MICRO_TO_ZWNJ = each(MICRO_SPACES, ZWNJ);
const WIDE_TO_SPACE = each(WIDE_SPACES, " ");
const DROP_BIDI = each(BIDI_CONTROLS, "");
const DIGITS = {
  latin: new Map([...pairs(ARABIC_INDIC_DIGITS, LATIN_DIGITS), ...pairs(PERSIAN_DIGITS, LATIN_DIGITS)]),
  "arabic-indic": new Map([
    ...pairs(LATIN_DIGITS, ARABIC_INDIC_DIGITS),
    ...pairs(PERSIAN_DIGITS, ARABIC_INDIC_DIGITS),
  ]),
};

/** Map Arabic presentation forms to their base letters. U+FEFF is left for the BOM step. */
function foldPresentationForms(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0) as number;
    const isForm = (code >= 0xfb50 && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfefe);
    out += isForm ? character.normalize("NFKC") : character;
  }
  return out;
}

/** Keep a ZWNJ only where it actually stops two letters from joining. */
export function cleanZwnj(text: string): string {
  return text
    .replaceAll(ZWJ, ZWNJ)
    .replace(ZWNJ_RUN, ZWNJ)
    .replace(ZWNJ_AFTER_NONJOINING, "$1")
    .replace(ZWNJ_EDGE, "");
}

/**
 * Script-independent cleaning, safe for any text: it never changes a letter's identity, only the
 * invisible machinery around it. Letter rules live in the ckb and kmr orthography modules.
 */
export function normalizeText(input: string, options: NormalizeOptions = {}): string {
  const {
    digits = "keep",
    stripUrls = true,
    stripEmails = true,
    stripMentions = false,
    stripEmoji = true,
    collapseBlankLines = true,
  } = options;
  let text = foldPresentationForms(input.normalize("NFC"));
  text = translate(text, DROP_BIDI);
  text = translate(text, MICRO_TO_ZWNJ);
  text = cleanZwnj(text);
  if (stripUrls) text = text.replace(URL, " ");
  if (stripEmails) text = text.replace(EMAIL, " ");
  if (stripMentions) text = text.replace(MENTION, " ");
  if (stripEmoji) text = text.replace(EMOJI, " ");
  if (digits !== "keep") text = translate(text, DIGITS[digits]);
  text = translate(text, WIDE_TO_SPACE).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  text = text.replace(HSPACE, " ");
  if (collapseBlankLines) text = text.replace(BLANK_LINES, "\n");
  return strip(text.split("\n").map(strip).join("\n"));
}
