import { functionWordsFor, suggest } from "@zimanyar/core";
import type { RuleContext, Sentence, Token, Variety } from "./model.js";

const suggestionCache = new WeakMap<RuleContext, Map<string, string[]>>();

/** Spelling suggestions, kept per word because the search is the slowest step of a check. */
export function suggestionsFor(word: string, context: RuleContext): string[] {
  if (context.lexicon === null) return [];
  let cache = suggestionCache.get(context);
  if (cache === undefined) {
    cache = new Map();
    suggestionCache.set(context, cache);
  }
  let found = cache.get(word);
  if (found === undefined) {
    found = suggest(word, context.lexicon).map((suggestion) => suggestion.word);
    cache.set(word, found);
  }
  return found;
}

/**
 * What a finding offers for a misspelt word: the suggestions or, when the check leaves them out to stay
 * quick, the word to ask about once someone looks at the finding.
 */
export function spellingFix(word: string, context: RuleContext): { suggestions: string[]; lookup?: string } {
  return context.deferSuggestions
    ? { suggestions: [], lookup: word }
    : { suggestions: suggestionsFor(word, context) };
}

/** A form's frequency in the corpus, or -1 for a word the lexicon lacks. */
export function frequencyOf(word: string, context: RuleContext): number {
  return context.lexicon?.form(word)?.frequency ?? -1;
}

export function hasForm(word: string, context: RuleContext): boolean {
  return context.lexicon?.has(word) ?? false;
}

/** The part of speech of a lemma, or null if it is not one. */
export function lemmaPos(word: string, context: RuleContext): string | null {
  return context.lexicon?.lemma(word)?.upos ?? null;
}

export const isLemma = (word: string, context: RuleContext): boolean => lemmaPos(word, context) !== null;

export function isFunctionWord(word: string, lang: Variety): boolean {
  return functionWordsFor(lang).has(word);
}

/** Consecutive tokens that are both words, so nothing such as a comma stands between them. */
export function wordPairs(sentence: Sentence): [Token, Token][] {
  const pairs: [Token, Token][] = [];
  const { words } = sentence;
  for (let i = 1; i < words.length; i++) {
    const [first, second] = [words[i - 1] as Token, words[i] as Token];
    if (second.index === first.index + 1) pairs.push([first, second]);
  }
  return pairs;
}

/** The word tokens of a paragraph. */
export const allWords = (sentences: readonly Sentence[]): Token[] =>
  sentences.flatMap((sentence) => sentence.words);
