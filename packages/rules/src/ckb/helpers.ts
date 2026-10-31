import { ckb, functionWordsFor } from "@zimanyar/core";
import { lemmaPos } from "../helpers.js";
import type { RuleContext } from "../model.js";

/** The clitic that marks each pronoun as an agent. */
export const PRONOUN_CLITIC: Readonly<Record<string, string>> = {
  من: "م",
  تۆ: "ت",
  ئەو: "ی",
  ئێمە: "مان",
  ئێوە: "تان",
  ئەوان: "یان",
};
const CLITIC_OF_PERSON: Readonly<Record<string, string>> = {
  "1sg": "م",
  "2sg": "ت",
  "3sg": "ی",
  "1pl": "مان",
  "2pl": "تان",
  "3pl": "یان",
};
const PROGRESSIVE = "دە";

const formsOf = (word: string) => ckb.defaultIndex().lookup(word);

export function hasVerbReading(word: string, context: RuleContext): boolean {
  return context.readings(word).some((reading) => reading.pos === "VERB");
}

/**
 * Whether a word is used as a noun. The lexicon gives a lemma one part of speech, so نان, also "to
 * put", is a verb there. A definite form that the lexicon reads as a noun settles it.
 */
export function isNounLike(word: string, context: RuleContext): boolean {
  if (lemmaPos(word, context) === "NOUN") return true;
  const definite = word + (ckb.endsWithVowel(word) ? "\u06a9\u06d5" : "\u06d5\u06a9\u06d5");
  return context.lexicon?.form(definite)?.upos === "NOUN";
}

/**
 * A noun with nothing on it. With the lexicon, it must be a noun lemma. Without, it must simply not
 * be a verb, a function word or a form with a clitic.
 */
export function isBareNoun(word: string, context: RuleContext): boolean {
  if (context.lexicon !== null) {
    if (!isNounLike(word, context)) return false;
    // هیچی: the lexicon lists it, but it is a known word with a clitic.
    const [stem, clitic] = ckb.splitEnclitic(word);
    return clitic === null || !(lemmaPos(stem, context) !== null || functionWordsFor("ckb").has(stem));
  }
  if (functionWordsFor("ckb").has(word) || formsOf(word).length > 0) return false;
  const [stem, clitic] = ckb.splitEnclitic(word);
  return clitic === null || stem.length < 2;
}

const CLITICS = [
  "\u0645\u0627\u0646",
  "\u062a\u0627\u0646",
  "\u06cc\u0627\u0646",
  "\u0645",
  "\u062a",
  "\u06cc",
];

/** A verb form with an object clitic inside it, which paradigms do not list: دەمبینیت, هەڵیدەگرم. */
export function isVerbWithObjectClitic(word: string): boolean {
  for (const clitic of CLITICS) {
    for (let at = word.indexOf(clitic); at >= 0; at = word.indexOf(clitic, at + 1)) {
      if (formsOf(word.slice(0, at) + word.slice(at + clitic.length)).length > 0) return true;
    }
  }
  return false;
}

/** The past of a transitive verb with no clitic of its own. */
export function externalAgentVerb(word: string, context: RuleContext): boolean {
  void context;
  return formsOf(word).some((form) => form.features["agent"] === "external");
}

export interface ClitickedVerb {
  /** The clitic for the agent, by itself. */
  clitic: string;
  /** The verb without it. */
  bare: string;
}

/** A simple past with the agent's clitic on the verb, such as خواردم, taken apart. */
export function agentCliticVerb(word: string, context: RuleContext): ClitickedVerb | null {
  void context;
  for (const form of formsOf(word)) {
    const { agent, aspect, tense, polarity } = form.features;
    if (tense !== "past" || aspect !== "perfective" || polarity !== undefined || agent === undefined)
      continue;
    const clitic = CLITIC_OF_PERSON[agent];
    if (clitic === undefined || !word.endsWith(clitic)) continue;
    const bare = word.slice(0, -clitic.length);
    if (formsOf(bare).some((other) => other.features["agent"] === "external")) return { clitic, bare };
  }
  return null;
}

/** A progressive past with the agent's clitic inside it, such as دەمخوارد, taken apart. */
export function progressiveAgentVerb(word: string, context: RuleContext): ClitickedVerb | null {
  void context;
  for (const form of formsOf(word)) {
    const { agent, aspect, polarity } = form.features;
    if (aspect !== "progressive" || polarity !== undefined || agent === undefined) continue;
    const clitic = CLITIC_OF_PERSON[agent];
    if (clitic === undefined || !word.startsWith(PROGRESSIVE + clitic)) continue;
    const bare = PROGRESSIVE + word.slice(PROGRESSIVE.length + clitic.length);
    if (formsOf(bare).some((other) => other.features["agent"] === "external")) return { clitic, bare };
  }
  return null;
}
