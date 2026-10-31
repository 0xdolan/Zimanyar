import { identify, type LidLang, tokenize } from "@zimanyar/core";
import type { Paragraph, Sentence, Token, Variety } from "./model.js";

const SENTENCE_END = new Set([".", "!", "?", "؟", "۔"]);
/** Below this, language identification is a guess and the script decides. */
const CONFIDENT = 0.6;
const OTHER_LANGUAGES: ReadonlySet<LidLang> = new Set(["zza", "hac", "fas", "arb", "tur", "eng"]);

export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let current: Token[] = [];
  const close = () => {
    const first = current[0];
    const last = current.at(-1);
    if (first !== undefined && last !== undefined) {
      sentences.push({
        start: first.start,
        end: last.end,
        tokens: current,
        words: current.filter((token) => token.kind === "word"),
      });
    }
    current = [];
  };
  for (const token of tokenize(text)) {
    current.push({ ...token, index: current.length });
    if (token.kind === "punct" && SENTENCE_END.has(token.text)) close();
  }
  close();
  return sentences;
}

/** Build the model of one paragraph. A stated variety skips language identification. */
/**
 * Letters Turkish does not have, and words it does not use. Kurmanji typed on a Turkish keyboard has dotless
 * ı, which the language identifier takes for Turkish: those are the writers this checker most helps.
 */
const KURMANJI_SIGNS = /[êxwqÊXWQ]|(?<![\p{L}\p{M}])(?:ez|tu|ji|li|bi|di|min|te|wî|wê)(?![\p{L}\p{M}])/iu;

export function buildParagraph(text: string, stated: Variety | "auto" = "auto"): Paragraph {
  const sentences = splitSentences(text);
  const found = identify(text);
  const fallback: Variety = found.script === "arabic" ? "ckb" : "kmr";
  if (stated !== "auto") {
    return { text, lang: stated, script: found.script, confidence: 1, otherLanguage: null, sentences };
  }
  if (found.lang === "tur" && KURMANJI_SIGNS.test(text)) {
    return { text, lang: "kmr", script: found.script, confidence: CONFIDENT, otherLanguage: null, sentences };
  }
  const sure = found.confidence >= CONFIDENT;
  const isVariety = found.lang === "ckb" || found.lang === "kmr";
  return {
    text,
    lang: sure && isVariety ? (found.lang as Variety) : fallback,
    script: found.script,
    confidence: found.confidence,
    otherLanguage: sure && OTHER_LANGUAGES.has(found.lang) ? found.lang : null,
    sentences,
  };
}

/** A paragraph is the text between line breaks, with its offset. */
export function splitParagraphs(text: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  for (const match of text.matchAll(/[^\n]+/g)) out.push({ start: match.index, text: match[0] });
  return out;
}
