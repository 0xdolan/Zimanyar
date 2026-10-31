import type { Lexicon } from "@zimanyar/data";
import { decline as declineCkb } from "./ckb/morphology.js";
import { defaultIndex as ckbIndex, conjugate as conjugateCkb, makeVerb as makeCkbVerb } from "./ckb/verbs.js";
import { decline as declineKmr, type Gender } from "./kmr/morphology.js";
import { conjugate as conjugateKmr, defaultIndex as kmrIndex, makeVerb as makeKmrVerb } from "./kmr/verbs.js";

export interface CompleteOptions {
  limit?: number;
  /** Add the forms of a verb or noun whose stem the prefix is. */
  includeInflections?: boolean;
}

export interface Completion {
  word: string;
  /** Zipf frequency in quarter steps; generated forms that are not in the lexicon have 0. */
  frequency: number;
  /** False when a form was generated and never seen in the corpus. */
  attested: boolean;
}

const better = (a: Completion, b: Completion): number =>
  Number(b.attested) - Number(a.attested) || b.frequency - a.frequency || (a.word < b.word ? -1 : 1);

function inflections(prefix: string, lexicon: Lexicon): string[] {
  const lemma = lexicon.lemma(prefix);
  if (lemma === null) return [];
  if (lemma.upos === "VERB") {
    if (lexicon.lang === "ckb") {
      const known = ckbIndex().verbs;
      const verb = makeCkbVerb(
        prefix,
        lemma.transitivity === "transitive",
        lemma.present ?? null,
        "guess",
        known,
      );
      return verb ? conjugateCkb(verb).map((form) => form.form) : [];
    }
    const known = kmrIndex().verbs;
    const verb = makeKmrVerb(
      prefix,
      lemma.transitivity === "transitive",
      lemma.present ?? null,
      "guess",
      known,
    );
    return verb ? conjugateKmr(verb).map((form) => form.form) : [];
  }
  if (lemma.upos !== "NOUN") return [];
  const cells =
    lexicon.lang === "ckb"
      ? declineCkb(prefix)
      : declineKmr(prefix, (lemma.gender === "m" ? "m" : "f") as Gender);
  return cells.flatMap(([, form]) => (form === null ? [] : [form]));
}

/**
 * Words that start with a prefix, most frequent first. A form generated from a paradigm and never
 * seen in the corpus never ranks above one that was.
 */
export function complete(prefix: string, lexicon: Lexicon, options: CompleteOptions = {}): Completion[] {
  const { limit = 8, includeInflections = true } = options;
  if (prefix === "") return [];
  const found = new Map<string, Completion>();
  for (const { word, rank } of lexicon.automaton.withPrefix(prefix)) {
    if (word === prefix) continue;
    found.set(word, { word, frequency: lexicon.frequencyAt(rank), attested: lexicon.attestedAt(rank) });
  }
  if (includeInflections) {
    for (const form of inflections(prefix, lexicon)) {
      if (form.startsWith(prefix) && form !== prefix && !found.has(form)) {
        found.set(form, { word: form, frequency: 0, attested: false });
      }
    }
  }
  return [...found.values()].sort(better).slice(0, limit);
}
