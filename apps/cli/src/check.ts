import { applyFixes, type Checker, type CheckOptions } from "@zimanyar/checker";
import { allRules, type Finding, type LessonRef, type Severity, type Variety } from "@zimanyar/rules";
import { lexiconFor } from "./data.js";
import { proseOf } from "./markdown.js";

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { hint: 0, warning: 1, error: 2 };
export type FailOn = Severity | "never";

/** A finding with where it is as a person reads a file: lines and columns from 1, in UTF-16 units. */
export interface Located extends Finding {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  /** The text the finding covers. */
  text: string;
  /** The variety of the finding's line, which chooses the lesson of a rule for both. */
  variety: Variety;
}

/** The lesson to point to first: the one in the variety the finding was written in. */
export const lessonsFirst = (finding: Located): LessonRef[] =>
  [...finding.lessons].sort(
    (a, b) => Number(b.lang === finding.variety) - Number(a.lang === finding.variety),
  );

export interface CheckedFile {
  /** The path given, or "-" for standard input. */
  path: string;
  text: string;
  findings: Located[];
}

/** Which rules a list leaves out. An entry names a rule, or every rule whose id starts with it and a dot. */
export function disabledBy(only: readonly string[], disable: readonly string[]): string[] {
  const matches = (id: string, entry: string) => id === entry || id.startsWith(`${entry}.`);
  return allRules()
    .map((rule) => rule.id)
    .filter(
      (id) =>
        (only.length > 0 && !only.some((entry) => matches(id, entry))) ||
        disable.some((entry) => matches(id, entry)),
    );
}

/** Rule ids and prefixes in a list that match no rule, which are probably typing mistakes. */
export function unknownRules(entries: readonly string[]): string[] {
  const ids = allRules().map((rule) => rule.id);
  return entries.filter((entry) => !ids.some((id) => id === entry || id.startsWith(`${entry}.`)));
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === "\n") starts.push(index + 1);
  return starts;
}

function position(starts: readonly number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((starts[middle] as number) <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: offset - (starts[low] as number) + 1 };
}

function locate(text: string, findings: readonly Finding[]): Located[] {
  const starts = lineStarts(text);
  return findings.map((finding) => {
    const start = position(starts, finding.range.start);
    const end = position(starts, finding.range.end);
    return {
      ...finding,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
      text: text.slice(finding.range.start, finding.range.end),
      variety:
        finding.lang !== "any"
          ? finding.lang
          : /\p{Script=Arabic}/u.test(text.slice(starts[start.line - 1], starts[start.line] ?? text.length))
            ? "ckb"
            : "kmr",
    };
  });
}

const loadedLexicons = new WeakMap<Checker, Set<Variety>>();

/** Give a checker the lexicons of these varieties, each once: setLexicon empties the checker's cache. */
export async function loadLexicons(
  checker: Checker,
  varieties: readonly Variety[],
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const known = loadedLexicons.get(checker) ?? new Set<Variety>();
  loadedLexicons.set(checker, known);
  for (const variety of varieties) {
    if (known.has(variety)) continue;
    const lexicon = await lexiconFor(variety, env);
    if (lexicon !== null) checker.setLexicon(lexicon);
    known.add(variety);
  }
}

export interface TextOptions extends CheckOptions {
  lang: Variety | "auto";
  markdown: boolean;
  fix: boolean;
  /** Words to accept as spelled right: names, terms, the person's own dictionary. */
  words?: ReadonlySet<string>;
}

/** Check one text. Markdown is checked in its prose only, at the offsets of the document. */
export async function checkText(
  checker: Checker,
  text: string,
  options: TextOptions,
  env: Readonly<Record<string, string | undefined>>,
): Promise<{ text: string; findings: Located[] }> {
  await loadLexicons(
    checker,
    (["ckb", "kmr"] as const).filter(
      (variety) => options.lang === variety || (options.lang === "auto" && usesScriptOf(text, variety)),
    ),
    env,
  );
  const { markdown, fix, words, ...checkOptions } = options;
  const findingsIn = (current: string) => findingsOf(checker, current, markdown, words, checkOptions);
  let current = text;
  if (fix) {
    for (let pass = 0; pass < 5; pass++) {
      const safe = findingsIn(current).filter((finding) => finding.safeFix);
      const next = safe.length === 0 ? current : applyFixes(current, safe);
      if (next === current) break;
      current = next;
    }
  }
  return { text: current, findings: locate(current, findingsIn(current)) };
}

/**
 * The findings of a text. In Markdown a finding that touches what was blanked is dropped: blanks are
 * not the writer's spacing, and a fix there would change the markup.
 */
function findingsOf(
  checker: Checker,
  text: string,
  markdown: boolean,
  words: ReadonlySet<string> | undefined,
  options: CheckOptions,
): Finding[] {
  const prose = markdown ? proseOf(text) : text;
  return checker.check(prose, options).filter((finding) => {
    const { start, end } = finding.range;
    if (words !== undefined && finding.category === "spelling" && words.has(text.slice(start, end)))
      return false;
    if (!markdown) return true;
    for (let index = start; index < end; index++) {
      if (prose[index] !== text[index]) return false;
    }
    return true;
  });
}

function usesScriptOf(text: string, variety: Variety): boolean {
  return variety === "ckb" ? /\p{Script=Arabic}/u.test(text) : /\p{Script=Latin}/u.test(text);
}

export const failsOn = (findings: readonly Finding[], failOn: FailOn): boolean =>
  failOn !== "never" && findings.some((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[failOn]);
