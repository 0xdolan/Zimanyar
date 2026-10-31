import { functionWordsFor, kmr } from "@zimanyar/core";
import { lemmaPos } from "../helpers.js";
import type { RuleContext, Token } from "../model.js";

export const DIRECT_PERSONS: Readonly<Record<string, readonly string[]>> = {
  ez: ["1sg"],
  tu: ["2sg"],
  em: ["pl"],
  hûn: ["pl"],
  ew: ["3sg", "pl"],
  ev: ["3sg", "pl"],
};
export const OBLIQUE_TO_DIRECT: Readonly<Record<string, string>> = {
  min: "ez",
  te: "tu",
  wî: "ew",
  wê: "ew",
  me: "em",
  we: "hûn",
  wan: "ew",
  vî: "ev",
  vê: "ev",
  van: "ev",
};
export const DIRECT_TO_OBLIQUE: Readonly<Record<string, string>> = {
  ez: "min",
  tu: "te",
  em: "me",
  hûn: "we",
};

/** Give a replacement the capital letter of the word it replaces. */
export function likeCase(original: string, replacement: string): string {
  const first = original[0] as string;
  if (first === kmr.lower(first)) return replacement;
  return kmr.upper(replacement[0] as string) + replacement.slice(1);
}

export const lowered = (token: Token): string => kmr.lower(token.text);

const formsOf = (word: string) => kmr.defaultIndex().lookup(word);

/** A noun's gender from the lexicon: f or m, or null when it is unknown or either. */
export function genderOf(word: string, context: RuleContext): "f" | "m" | null {
  const gender = context.lexicon?.lemma(word)?.gender;
  return gender === "f" || gender === "m" ? gender : null;
}

/** A noun with nothing on it. With no lexicon, a word that is not a verb or a function word. */
export function isBareNoun(word: string, context: RuleContext): boolean {
  if (context.lexicon !== null) {
    // The lexicon gives a lemma one part of speech, so nan, also a verb's form, is a verb there.
    // An indefinite form that it reads as a noun settles it.
    return lemmaPos(word, context) === "NOUN" || context.lexicon.form(`${word}ek`)?.upos === "NOUN";
  }
  return !functionWordsFor("kmr").has(word) && formsOf(word).length === 0;
}

const hasFeature = (word: string, test: (features: Record<string, string>) => boolean) =>
  formsOf(word).some((form) => test(form.features));

/** A form of a past-stem tense that agrees with its object, which means a transitive verb. */
export const isErgativePast = (word: string): boolean =>
  hasFeature(word, (f) => f["agreement"] === "object" && f["tense"] !== undefined);

export interface VerbReading {
  lemma: string;
  features: Record<string, string>;
}

/** A form of the present indicative. */
export function presentForm(word: string): VerbReading | null {
  const form = formsOf(word).find(
    (f) => f.features["tense"] === "present" && f.features["mood"] === "indicative",
  );
  return form ? { lemma: form.lemma, features: form.features } : null;
}

/** The same form of a verb in another person or mood, from the verb's paradigm. */
export function reinflect(
  lemma: string,
  match: (features: Record<string, string>) => boolean,
): string | null {
  const verb = kmr.defaultIndex().verbs.get(lemma);
  if (verb === undefined) return null;
  return kmr.conjugate(verb).find((form) => match(form.features))?.form ?? null;
}
