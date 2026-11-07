import { type PracticeState, parsePractice } from "@zimanyar/practice/store";
import type { Platform } from "./platform";

/** The lock the extension's background takes too, so that two writers never lose each other's work. */
export const PRACTICE_LOCK = "zimanyar-practice";

let queue: Promise<unknown> = Promise.resolve();

/**
 * Reads the stored practice, changes it and saves it, one change at a time. Another context (the
 * extension's background) may write in between two changes, so each one starts from storage.
 */
export function updatePractice(
  practice: Platform["practice"],
  change: (state: PracticeState) => PracticeState,
): Promise<PracticeState> {
  const run = async (): Promise<PracticeState> => {
    const next = change(parsePractice(await practice.load()));
    await practice.save(next);
    return next;
  };
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  const result = queue.then(async () => (locks ? await locks.request(PRACTICE_LOCK, run) : run()));
  queue = result.catch(() => {});
  return result;
}
