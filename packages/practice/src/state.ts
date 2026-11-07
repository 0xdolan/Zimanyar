import type { Course } from "@zimanyar/content";
import { z } from "zod";
import type { DrillKind } from "./drills.js";
import { addMistake, MAX_MISTAKES, type Mistake, type MistakeAction } from "./history.js";
import { type Card, isDue, isMature, newCard, review } from "./sm2.js";

export type { MistakeAction };

const CURRENT_VERSION = 1;
/** More drills than there are, so that the bound only stops a damaged or hostile file. */
const MAX_CARDS = 20_000;
/** Days of results kept for the progress page. */
const DAYS_KEPT = 90;

const drillId = z
  .string()
  .regex(/^(verb|noun|spot):/)
  .max(200);
const cardSchema = z.object({
  ease: z.number().min(1.3).max(10),
  interval: z.number().int().min(0).max(36_500),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  due: z.number().int().min(0),
});
const mistakeSchema = z.object({
  rule: z.string().min(1).max(100),
  action: z.enum(["applied", "ignored"]),
  at: z.number().int().min(0),
});
const dayKey = z.string().regex(/^\d{4}-\d\d-\d\d$/);
const daySchema = z.object({ right: z.number().int().min(0), wrong: z.number().int().min(0) });

export interface PracticeState {
  version: typeof CURRENT_VERSION;
  cards: Record<string, Card>;
  mistakes: Mistake[];
  /** Right and wrong answers by local date, YYYY-MM-DD. */
  days: Record<string, { right: number; wrong: number }>;
}

export const emptyPractice = (): PracticeState => ({
  version: CURRENT_VERSION,
  cards: {},
  mistakes: [],
  days: {},
});

/** Entries of a stored record that are valid, dropping the rest rather than everything. */
function validEntries<T>(
  value: unknown,
  key: z.ZodType<string>,
  schema: z.ZodType<T>,
  max: number,
): [string, T][] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value)
    .slice(0, max)
    .flatMap(([name, entry]) => {
      const parsed = schema.safeParse(entry);
      return key.safeParse(name).success && parsed.success ? [[name, parsed.data] as [string, T]] : [];
    });
}

/**
 * Practice from storage, which cannot be trusted. A damaged entry is dropped and the rest kept, as
 * losing months of reviews for one bad value would be worse than losing that value.
 */
export function parsePractice(stored: unknown): PracticeState {
  if (typeof stored !== "object" || stored === null) return emptyPractice();
  const { cards, mistakes, days } = stored as Record<string, unknown>;
  return {
    version: CURRENT_VERSION,
    cards: Object.fromEntries(validEntries(cards, drillId, cardSchema, MAX_CARDS)),
    mistakes: (Array.isArray(mistakes) ? mistakes : [])
      .flatMap((entry) => {
        const parsed = mistakeSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
      .slice(-MAX_MISTAKES),
    days: Object.fromEntries(validEntries(days, dayKey, daySchema, DAYS_KEPT)),
  };
}

/** The local date of a moment, as days are kept. */
export function dateOf(now: number): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The state after an answer: a right answer counts as good (4), a wrong one as a lapse (1). */
export function answer(state: PracticeState, id: string, right: boolean, now: number): PracticeState {
  const card = state.cards[id] ?? newCard(now);
  const today = dateOf(now);
  const day = state.days[today] ?? { right: 0, wrong: 0 };
  const days = Object.fromEntries(
    Object.entries({
      ...state.days,
      [today]: right ? { ...day, right: day.right + 1 } : { ...day, wrong: day.wrong + 1 },
    })
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-DAYS_KEPT),
  );
  return { ...state, cards: { ...state.cards, [id]: review(card, right ? 4 : 1, now) }, days };
}

/** The state with a finding the writer fixed or dismissed added to the mistake history. */
export const recordMistake = (
  state: PracticeState,
  rule: string,
  action: MistakeAction,
  now: number,
): PracticeState => ({
  ...state,
  mistakes: addMistake(state.mistakes, { rule, action, at: now }),
});

export interface PracticeFilter {
  lang: Course;
  kinds: readonly DrillKind[];
}

export const matches = (id: string, { lang, kinds }: PracticeFilter): boolean => {
  const [kind = "", second = ""] = id.split(":");
  if (!(kinds as readonly string[]).includes(kind)) return false;
  return kind === "spot" ? second.startsWith(`${lang}.`) : second === lang;
};

export interface Progress {
  /** Drills waiting for review now. */
  due: number;
  /** Drills answered at least once. */
  seen: number;
  /** Drills known well enough to wait three weeks. */
  mature: number;
  today: { right: number; wrong: number };
  /** Days in a row with practice, up to today, or yesterday when today has none yet. */
  streak: number;
}

export function progress(state: PracticeState, filter: PracticeFilter, now: number): Progress {
  const cards = Object.entries(state.cards).filter(([id]) => matches(id, filter));
  let streak = 0;
  const day = new Date(now);
  if (state.days[dateOf(now)] === undefined) day.setDate(day.getDate() - 1);
  while (state.days[dateOf(day.getTime())] !== undefined) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return {
    due: cards.filter(([, card]) => isDue(card, now)).length,
    seen: cards.length,
    mature: cards.filter(([, card]) => isMature(card)).length,
    today: state.days[dateOf(now)] ?? { right: 0, wrong: 0 },
    streak,
  };
}
