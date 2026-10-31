import { Lexicon } from "@zimanyar/data";
import { buildLexicon, type FormRow, type LemmaRow } from "@zimanyar/data/builder";
import { expect, it } from "vitest";
import {
  buildParagraph,
  createContext,
  type Rule,
  runRules,
  type Strictness,
  type Variety,
} from "../src/index.js";

type Noun = [lemma: string, gender?: string];

/** A small lexicon of words the lessons use, so a rule's tests need no download. */
export function makeLexicon(
  lang: Variety,
  lemmas: readonly LemmaRow[],
  variants: readonly { variant: string; standard: string }[] = [],
  otherForms: readonly string[] = [],
): Lexicon {
  const form = (word: string, lemma: string, upos: string, zipf: number): FormRow => ({
    word,
    lemma,
    upos,
    features: "{}",
    attested: true,
    zipf,
    quality: "gold",
  });
  const first = lemmas[0]?.lemma ?? "";
  const forms: FormRow[] = [
    ...lemmas.map((row) => form(row.lemma, row.lemma, row.upos, row.zipf)),
    ...otherForms.map((word) => form(word, first, "NOUN", 3)),
  ];
  return new Lexicon(buildLexicon({ lang, zimankit: "test", data: "test", forms, lemmas, variants }));
}

export const nouns = (rows: readonly Noun[]): LemmaRow[] =>
  rows.map(([lemma, gender]) => ({
    lemma,
    upos: "NOUN",
    ...(gender ? { gender } : {}),
    zipf: 4,
    count: 1000,
  }));

export interface RuleCases {
  rule: Rule;
  lang: Variety;
  lexicon?: Lexicon | null;
  strictness?: Strictness;
  /** Text with the mistake, and the fix for its first finding where the rule offers one. */
  positive: readonly (readonly [text: string, fix?: string])[];
  /** Correct text, or text this rule must leave alone. */
  negative: readonly string[];
}

/** A paragraph as the rule alone sees it, through the runner: thresholds and all. */
export function runOne(
  rule: Rule,
  text: string,
  lang: Variety,
  lexicon: Lexicon | null = null,
  strictness: Strictness = "standard",
) {
  const context = createContext(lang, { lexicon, strictness });
  return runRules(buildParagraph(text, lang), [rule], context);
}

/** The cases every rule needs: at least ten that it finds, and ten that it must not. */
export function ruleCases({
  rule,
  lang,
  lexicon = null,
  strictness = "standard",
  positive,
  negative,
}: RuleCases): void {
  it("has at least ten positive and ten negative cases", () => {
    expect(positive.length).toBeGreaterThanOrEqual(10);
    expect(negative.length).toBeGreaterThanOrEqual(10);
  });
  it.each(positive.map(([text, fix]) => [text, fix] as const))("finds %j", (text, fix) => {
    const found = runOne(rule, text, lang, lexicon, strictness);
    expect(found.length).toBeGreaterThan(0);
    if (fix !== undefined) expect(found[0]?.suggestions.map((s) => s.text)).toContain(fix);
  });
  it.each(negative.map((text) => [text] as const))("leaves %j alone", (text) => {
    expect(runOne(rule, text, lang, lexicon, strictness)).toEqual([]);
  });
}
