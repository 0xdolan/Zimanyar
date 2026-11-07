import { type Completion, complete } from "@zimanyar/core";
import type { Lexicon } from "@zimanyar/data";
import {
  buildParagraph,
  createContext,
  type Finding,
  NOTICE_RULE,
  type RuleContext,
  rulesFor,
  runRules,
  type Strictness,
  splitParagraphs,
  suggestionsFor,
  type Variety,
} from "@zimanyar/rules";

export interface CheckOptions {
  /** The variety to check as. Automatic by default, per paragraph. */
  lang?: Variety | "auto";
  strictness?: Strictness;
  /** Rules to leave out, by id. */
  disabledRules?: readonly string[];
  /** Leave spelling suggestions out, for checking as someone types. `suggest` finds them later. */
  deferSuggestions?: boolean;
}

/** Paragraphs kept before the oldest is dropped, which is many pages of editing. */
const CACHE_LIMIT = 2000;

/**
 * Checks text paragraph by paragraph. Only a changed paragraph is checked again: an unchanged one
 * takes its findings from the cache, moved to its new position.
 */
export class Checker {
  private readonly lexicons = new Map<Variety, Lexicon>();
  private readonly contexts = new Map<string, RuleContext>();
  private readonly cache = new Map<string, Finding[]>();

  /** Rule tests and the first moments of a session have no lexicon: rules that need one find nothing. */
  setLexicon(lexicon: Lexicon): void {
    this.lexicons.set(lexicon.lang, lexicon);
    this.contexts.clear();
    this.cache.clear();
  }

  private contextFor(lang: Variety, strictness: Strictness, deferSuggestions: boolean): RuleContext {
    const key = `${lang}\0${strictness}\0${deferSuggestions}`;
    let context = this.contexts.get(key);
    if (context === undefined) {
      context = createContext(lang, {
        lexicon: this.lexicons.get(lang) ?? null,
        strictness,
        deferSuggestions,
      });
      this.contexts.set(key, context);
    }
    return context;
  }

  private checkParagraph(text: string, options: Required<CheckOptions>): Finding[] {
    const key = `${options.lang}\0${options.strictness}\0${options.deferSuggestions}\0${options.disabledRules.join(",")}\0${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      // Refreshing its place keeps what is being edited in the cache.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const paragraph = buildParagraph(text, options.lang);
    const context = this.contextFor(paragraph.lang, options.strictness, options.deferSuggestions);
    const disabled = new Set(options.disabledRules);
    const rules = paragraph.otherLanguage !== null ? [NOTICE_RULE] : rulesFor(paragraph.lang);
    const findings = runRules(
      paragraph,
      rules.filter((rule) => !disabled.has(rule.id)),
      context,
    );
    this.cache.set(key, findings);
    if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value as string);
    return findings;
  }

  /** Every finding in a text, in order, with offsets into that text. */
  check(text: string, options: CheckOptions = {}): Finding[] {
    const resolved: Required<CheckOptions> = {
      lang: options.lang ?? "auto",
      strictness: options.strictness ?? "standard",
      disabledRules: options.disabledRules ?? [],
      deferSuggestions: options.deferSuggestions ?? false,
    };
    return splitParagraphs(text).flatMap(({ start, text: paragraph }) =>
      this.checkParagraph(paragraph, resolved).map((finding) => ({
        ...finding,
        id: `${finding.id}:${start}`,
        range: { start: finding.range.start + start, end: finding.range.end + start },
      })),
    );
  }

  /** Spelling suggestions for one word, for a finding whose `lookup` asks for them. */
  suggest(word: string, lang: Variety): string[] {
    return suggestionsFor(word, this.contextFor(lang, "standard", false));
  }

  /** Words that begin with what is being typed, attested ones first. */
  complete(prefix: string, lang: Variety, limit?: number): Completion[] {
    const lexicon = this.lexicons.get(lang);
    if (lexicon === undefined) return [];
    return complete(prefix, lexicon, { includeInflections: true, ...(limit !== undefined ? { limit } : {}) });
  }

  get cachedParagraphs(): number {
    return this.cache.size;
  }
}

/** Apply suggestions to a text. Later ranges go first, so earlier offsets stay right. */
export function applyFixes(text: string, findings: readonly Finding[]): string {
  const ordered = [...findings]
    .filter((finding) => finding.suggestions[0] !== undefined)
    .sort((a, b) => b.range.start - a.range.start);
  let out = text;
  let limit = text.length;
  for (const finding of ordered) {
    // Two fixes for one span would corrupt each other; the later one waits for the next check.
    if (finding.range.end > limit) continue;
    out =
      out.slice(0, finding.range.start) + (finding.suggestions[0]?.text ?? "") + out.slice(finding.range.end);
    limit = finding.range.start;
  }
  return out;
}

/** Apply every deterministic fix, checking again until nothing is left, as one fix can reveal another. */
export function fixAllSafe(checker: Checker, text: string, options: CheckOptions = {}): string {
  let current = text;
  for (let pass = 0; pass < 5; pass++) {
    const safe = checker.check(current, options).filter((finding) => finding.safeFix);
    if (safe.length === 0) return current;
    const next = applyFixes(current, safe);
    if (next === current) return current;
    current = next;
  }
  return current;
}
