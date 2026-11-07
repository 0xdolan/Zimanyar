/** What spaced repetition knows about one drill. Times are milliseconds since the epoch. */
export interface Card {
  /** How easy the drill is, from 1.3 up. A new card starts at 2.5. */
  ease: number;
  /** Days until the next review. */
  interval: number;
  /** Right answers in a row. */
  reps: number;
  lapses: number;
  due: number;
}

/** How well an answer went, 0 (nothing) to 5 (perfect), as SM-2 grades it. */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export const DAY = 86_400_000;
const MIN_EASE = 1.3;

export const newCard = (now: number): Card => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now });

/**
 * The card after one answer, by SuperMemo 2: a wrong answer starts the card over tomorrow and keeps
 * its ease, a right one waits one day, then six, then the last wait times the ease.
 */
export function review(card: Card, quality: Quality, now: number): Card {
  if (quality < 3) return { ...card, reps: 0, interval: 1, lapses: card.lapses + 1, due: now + DAY };
  const reps = card.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval * card.ease);
  const miss = 5 - quality;
  const ease = Math.max(MIN_EASE, card.ease + 0.1 - miss * (0.08 + miss * 0.02));
  return {
    ease: Math.round(ease * 100) / 100,
    interval,
    reps,
    lapses: card.lapses,
    due: now + interval * DAY,
  };
}

export const isDue = (card: Card, now: number): boolean => card.due <= now;

/** Known well enough to wait three weeks, as SuperMemo calls a mature card. */
export const isMature = (card: Card): boolean => card.interval >= 21;
