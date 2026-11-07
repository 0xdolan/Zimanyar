import { allRuleMeta, type LessonRef } from "@zimanyar/rules";
import { DAY } from "./sm2.js";

/** What the writer did with a finding: fixed it, or dismissed it. */
export type MistakeAction = "applied" | "ignored";

export interface Mistake {
  rule: string;
  action: MistakeAction;
  at: number;
}

/** The history keeps this many, dropping the oldest. */
export const MAX_MISTAKES = 500;
/** A mistake counts half as much after this long, so that recent habits lead. */
const HALF_LIFE = 30 * DAY;
/**
 * A dismissed finding counts for less than a fixed one: it may be a word the checker does not know.
 * It still counts, as dismissing a correct finding is a reason to read the lesson.
 */
const WEIGHT: Record<MistakeAction, number> = { applied: 1, ignored: 0.5 };

export const addMistake = (history: readonly Mistake[], mistake: Mistake): Mistake[] =>
  [...history, mistake].slice(-MAX_MISTAKES);

export interface FrequentMistake {
  rule: string;
  /** How much the rule counts now, with older mistakes worth less. */
  weight: number;
  applied: number;
  ignored: number;
  last: number;
}

/** The rules behind the writer's mistakes, most frequent first. Notices and unknown rules are left out. */
export function frequentMistakes(history: readonly Mistake[], now: number): FrequentMistake[] {
  const teachable = new Set(allRuleMeta().flatMap((rule) => (rule.notice ? [] : [rule.id])));
  const byRule = new Map<string, FrequentMistake>();
  for (const { rule, action, at } of history) {
    if (!teachable.has(rule)) continue;
    const entry = byRule.get(rule) ?? { rule, weight: 0, applied: 0, ignored: 0, last: 0 };
    entry.weight += WEIGHT[action] * 0.5 ** (Math.max(0, now - at) / HALF_LIFE);
    entry[action] += 1;
    entry.last = Math.max(entry.last, at);
    byRule.set(rule, entry);
  }
  return [...byRule.values()].sort(
    (a, b) => b.weight - a.weight || b.last - a.last || a.rule.localeCompare(b.rule),
  );
}

export interface Recommendation {
  lesson: LessonRef;
  weight: number;
  /** The rules that led here, most frequent first. */
  rules: string[];
}

/** Lessons to read, from the first lesson of each rule behind the writer's mistakes. */
export function recommendLessons(history: readonly Mistake[], now: number, limit = 5): Recommendation[] {
  const lessonOf = new Map(allRuleMeta().map((rule) => [rule.id, rule.lessons[0]]));
  const byLesson = new Map<string, Recommendation>();
  for (const { rule, weight } of frequentMistakes(history, now)) {
    const lesson = lessonOf.get(rule);
    if (lesson === undefined) continue;
    const key = `${lesson.lang}:${lesson.lessonId}:${lesson.anchor}`;
    const entry = byLesson.get(key) ?? { lesson, weight: 0, rules: [] };
    entry.weight += weight;
    entry.rules.push(rule);
    byLesson.set(key, entry);
  }
  return [...byLesson.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
}
