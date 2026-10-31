import type { Analysis, Token as CoreToken, LidLang, Script } from "@zimanyar/core";
import type { Lexicon } from "@zimanyar/data";

export type Variety = "ckb" | "kmr";
export type RuleLang = Variety | "any";
export type Category =
  | "orthography"
  | "spelling"
  | "morphology"
  | "agreement"
  | "syntax"
  | "punctuation"
  | "style";
export type Severity = "error" | "warning" | "hint";
export type Strictness = "standard" | "tolerant";

/** Families run in this order, and a later one may explain a span better than an earlier one. */
export const CATEGORY_ORDER: readonly Category[] = [
  "orthography",
  "punctuation",
  "spelling",
  "morphology",
  "agreement",
  "syntax",
  "style",
];

export interface Token extends CoreToken {
  /** Position among the tokens of its sentence. */
  index: number;
}

export interface Sentence {
  /** Offsets into the paragraph. */
  start: number;
  end: number;
  tokens: readonly Token[];
  /** The word tokens only. */
  words: readonly Token[];
}

export interface Paragraph {
  text: string;
  /** The variety rules should check this paragraph as. */
  lang: Variety;
  script: Script;
  /** How sure language identification is, from 0 to 1. */
  confidence: number;
  /** Set when the paragraph is in another language, which is noticed but never checked. */
  otherLanguage: LidLang | null;
  sentences: readonly Sentence[];
}

/** One suggested replacement, with an optional label. */
export interface SuggestionText {
  text: string;
  label?: string;
}

/** What a rule reports. Everything else about a finding comes from the rule's metadata. */
export interface RawFinding {
  /** Offsets into the paragraph. */
  start: number;
  end: number;
  suggestions: readonly (string | SuggestionText)[];
  /** The word to look suggestions up for, when the check left them out. */
  lookup?: string;
  /** Values for the rule's message. */
  params?: Readonly<Record<string, string>>;
  /** Overrides the rule's own confidence, for a case it is less sure of. */
  confidence?: number;
}

export interface RuleContext {
  /** The compiled lexicon, or null when it has not been loaded: rules that need it find nothing. */
  lexicon: Lexicon | null;
  strictness: Strictness;
  /** Leave spelling suggestions out of findings, as the search is the slowest step of a check. */
  deferSuggestions: boolean;
  /** Every reading of a word, best first, cached per word. */
  readings(word: string): readonly Analysis[];
  /** The same as an analyzer, for engine functions that take one. */
  analyzer: { analyze(word: string): readonly Analysis[]; best(word: string): Analysis | null };
}

export interface Rule {
  id: string;
  check(paragraph: Paragraph, context: RuleContext): readonly RawFinding[];
}

export interface MessageRef {
  key: string;
  params?: Readonly<Record<string, string>>;
}

export interface LessonRef {
  lang: Variety;
  lessonId: number;
  anchor: string;
  title: string;
}

export interface RuleExample {
  wrong: string;
  right: string;
  gloss?: string;
}

export interface Finding {
  /** A stable hash of the rule, range and text. */
  id: string;
  ruleId: string;
  lang: RuleLang;
  category: Category;
  severity: Severity;
  /** UTF-16 offsets into the checked text. */
  range: { start: number; end: number };
  message: MessageRef;
  reason: MessageRef;
  suggestions: readonly SuggestionText[];
  /** The word to look suggestions up for, when the check left them out. */
  lookup?: string;
  examples: readonly RuleExample[];
  lessons: readonly LessonRef[];
  confidence: number;
  /** True only for deterministic orthography fixes. */
  safeFix: boolean;
}
