import type { Lexicon } from "@zimanyar/data";
import { CkbAnalyzer } from "./ckb/morphology.js";
import { spellingVariants } from "./ckb/orthography.js";
import { KmrAnalyzer } from "./kmr/morphology.js";
import { lexiconAdapter } from "./lexicon-adapter.js";
import { round } from "./python.js";
import type { Analysis } from "./schema.js";
import { isConfusable } from "./text.js";

const CONFUSABLE_COST = 0.3;
const QUALITY_ORDER = { gold: 2, silver: 1, bronze: 0 } as const;

export interface SuggestOptions {
  /** How many suggestions to return. */
  limit?: number;
  /** The largest edit cost to consider. By default 1 for words of up to three letters, otherwise 2. */
  maxCost?: number;
}

export interface Suggestion {
  word: string;
  /** Edit cost: 0 for a known variant, 0.3 for a swap of letters that writers confuse, 1 for any other edit. */
  cost: number;
  source: "variant" | "confusable" | "search" | "stem";
}

/** Every word of an automaton within an edit cost: a Damerau search, walking only live branches. */
function search(lexicon: Lexicon["automaton"], word: string, maxCost: number): Map<string, number> {
  const found = new Map<string, number>();
  const target = Array.from({ length: word.length }, (_, i) => word.charCodeAt(i));
  const size = target.length;
  const firstRow = Float64Array.from({ length: size + 1 }, (_, j) => j);

  const visit = (
    node: number,
    prefix: string,
    previous: Float64Array,
    before: Float64Array | null,
    last: number,
  ) => {
    lexicon.forEachArc(node, (unit, final, next) => {
      const row = new Float64Array(size + 1);
      row[0] = (previous[0] as number) + 1;
      let best = row[0] as number;
      for (let j = 1; j <= size; j++) {
        const expected = target[j - 1] as number;
        let swap = 0;
        if (expected !== unit) {
          swap = isConfusable(String.fromCharCode(expected), String.fromCharCode(unit)) ? CONFUSABLE_COST : 1;
        }
        let cost = Math.min(
          (previous[j] as number) + 1,
          (row[j - 1] as number) + 1,
          (previous[j - 1] as number) + swap,
        );
        if (before !== null && j > 1 && expected === last && target[j - 2] === unit) {
          cost = Math.min(cost, (before[j - 2] as number) + 1);
        }
        row[j] = cost;
        if (cost < best) best = cost;
      }
      const text = prefix + String.fromCharCode(unit);
      if (final && (row[size] as number) <= maxCost) found.set(text, row[size] as number);
      if (best <= maxCost && next !== 0) visit(next, text, row, previous, unit);
    });
  };
  visit(lexicon.start, "", firstRow, null, -1);
  return found;
}

const analyzers = new WeakMap<Lexicon, CkbAnalyzer | KmrAnalyzer>();

function analyzerFor(lexicon: Lexicon): CkbAnalyzer | KmrAnalyzer {
  let analyzer = analyzers.get(lexicon);
  if (analyzer === undefined) {
    const adapter = lexiconAdapter(lexicon);
    analyzer = lexicon.lang === "ckb" ? new CkbAnalyzer(adapter) : new KmrAnalyzer(adapter);
    analyzers.set(lexicon, analyzer);
  }
  return analyzer;
}

/** The readings that took off an ending, so that a misspelt stem can keep its ending. */
function stemsWithEndings(readings: readonly Analysis[], lexicon: Lexicon): [stem: string, ending: string][] {
  const out: [string, string][] = [];
  for (const reading of readings.slice(0, 8)) {
    const [first, ...rest] = reading.segments;
    if (first === undefined || first[1] !== "STEM" || rest.length === 0) continue;
    if (lexicon.lemmaAutomaton.has(first[0]) || first[0].length < 3) continue;
    const ending = rest.map(([morph]) => morph).join("");
    if (!out.some(([stem, seen]) => stem === first[0] && seen === ending)) out.push([first[0], ending]);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Suggestions for a word that is not in the lexicon, from the learned variants, the letters writers
 * confuse, a search of the lexicon, and a corrected stem with its original ending. Ranked by cost,
 * then frequency, then quality.
 */
export function suggest(word: string, lexicon: Lexicon, options: SuggestOptions = {}): Suggestion[] {
  const { limit = 5, maxCost = word.length <= 3 ? 1 : 2 } = options;
  if (word === "") return [];
  const forms = lexicon.automaton;
  const found = new Map<string, Suggestion>();
  const add = (candidate: string, cost: number, source: Suggestion["source"]) => {
    if (candidate === word || !forms.has(candidate)) return;
    const rounded = round(cost, 6);
    const existing = found.get(candidate);
    if (existing === undefined || rounded < existing.cost)
      found.set(candidate, { word: candidate, cost: rounded, source });
  };

  const standard = lexicon.standardSpelling(word);
  if (standard !== null) add(standard, 0, "variant");
  for (const [candidate, cost] of search(forms, word, maxCost)) add(candidate, cost, "search");
  if (lexicon.lang === "ckb") {
    // The toggles also reach what the search prices above its limit, such as several confusions.
    for (const variant of spellingVariants(word))
      add(variant, Math.min(maxCost, CONFUSABLE_COST), "confusable");
  }
  if (found.size < limit) {
    for (const [stem, ending] of stemsWithEndings(analyzerFor(lexicon).analyze(word, true), lexicon)) {
      for (const [candidate, cost] of search(lexicon.lemmaAutomaton, stem, Math.min(maxCost, 2))) {
        add(candidate + ending, cost, "stem");
      }
    }
  }
  const rank = (suggestion: Suggestion) => forms.rank(suggestion.word);
  return [...found.values()]
    .sort(
      (a, b) =>
        a.cost - b.cost ||
        lexicon.frequencyAt(rank(b)) - lexicon.frequencyAt(rank(a)) ||
        QUALITY_ORDER[lexicon.qualityAt(rank(b))] - QUALITY_ORDER[lexicon.qualityAt(rank(a))] ||
        (a.word < b.word ? -1 : 1),
    )
    .slice(0, limit);
}
