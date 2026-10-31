import { ckb, kmr, lexiconAdapter } from "@zimanyar/core";
import type { Lexicon } from "@zimanyar/data";
import { ruleMeta } from "./messages.js";
import {
  CATEGORY_ORDER,
  type Finding,
  type Paragraph,
  type RawFinding,
  type Rule,
  type RuleContext,
  type Strictness,
} from "./model.js";

/** Below this confidence a finding is hidden, in each mode. */
const THRESHOLD: Record<Strictness, number> = { standard: 0.4, tolerant: 0.6 };
/** How much a paragraph whose language is a guess lowers every finding's confidence. */
const UNSURE_PENALTY = 0.2;
const SURE_LANGUAGE = 0.6;
const SPELLING = "spelling";

/** Stable across runs and machines: FNV-1a over the rule, range and text. */
export function findingId(ruleId: string, start: number, end: number, text: string): string {
  const input = `${ruleId}\0${start}\0${end}\0${text}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface ContextOptions {
  lexicon: Lexicon | null;
  strictness: Strictness;
}

/** The analyzers are expensive to build and words repeat, so both are kept per context. */
export function createContext(lang: "ckb" | "kmr", { lexicon, strictness }: ContextOptions): RuleContext {
  const adapter = lexicon ? lexiconAdapter(lexicon) : undefined;
  const analyzer = lang === "ckb" ? new ckb.CkbAnalyzer(adapter) : new kmr.KmrAnalyzer(adapter);
  const cache = new Map<string, ReturnType<typeof analyzer.analyze>>();
  const readings = (word: string) => {
    let found = cache.get(word);
    if (found === undefined) {
      found = analyzer.analyze(word);
      cache.set(word, found);
    }
    return found;
  };
  return {
    lexicon,
    strictness,
    readings,
    analyzer: { analyze: readings, best: (word) => readings(word)[0] ?? null },
  };
}

function toFinding(rule: Rule, raw: RawFinding, paragraph: Paragraph, offset: number): Finding {
  const meta = ruleMeta(rule.id);
  const unsure = paragraph.confidence < SURE_LANGUAGE ? UNSURE_PENALTY : 0;
  const params = raw.params ?? {};
  return {
    id: findingId(rule.id, raw.start + offset, raw.end + offset, paragraph.text.slice(raw.start, raw.end)),
    ruleId: rule.id,
    lang: meta.lang,
    category: meta.category,
    severity: meta.severity,
    range: { start: raw.start + offset, end: raw.end + offset },
    message: { key: `rule.${rule.id}.message`, params },
    reason: { key: `rule.${rule.id}.reason`, params },
    suggestions: raw.suggestions.map((suggestion) =>
      typeof suggestion === "string" ? { text: suggestion } : suggestion,
    ),
    examples: meta.examples,
    lessons: meta.lessons,
    confidence: Math.max(0, (raw.confidence ?? meta.confidence) - unsure),
    safeFix: meta.safeFix,
  };
}

const overlaps = (a: Finding, b: Finding) => a.range.start < b.range.end && b.range.start < a.range.end;

/** A spelling finding says only that a word is unknown, so any other finding on it explains it better. */
function dropExplainedSpelling(findings: readonly Finding[]): Finding[] {
  const others = findings.filter((finding) => finding.category !== SPELLING);
  return findings.filter(
    (finding) => finding.category !== SPELLING || !others.some((other) => overlaps(finding, other)),
  );
}

const rank = (finding: Finding) => CATEGORY_ORDER.indexOf(finding.category);

/** Run the rules for a paragraph's variety, in family order. */
export function runRules(
  paragraph: Paragraph,
  rules: readonly Rule[],
  context: RuleContext,
  offset = 0,
): Finding[] {
  const threshold = THRESHOLD[context.strictness];
  const findings: Finding[] = [];
  for (const rule of rules) {
    const meta = ruleMeta(rule.id);
    if (meta.standardOnly && context.strictness === "tolerant") continue;
    for (const raw of rule.check(paragraph, context)) {
      const finding = toFinding(rule, raw, paragraph, offset);
      if (finding.confidence >= threshold) findings.push(finding);
    }
  }
  return dropExplainedSpelling(findings).sort(
    (a, b) => a.range.start - b.range.start || rank(a) - rank(b) || (a.ruleId < b.ruleId ? -1 : 1),
  );
}
