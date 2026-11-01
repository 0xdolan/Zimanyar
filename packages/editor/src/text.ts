import type { Finding, Variety } from "@zimanyar/rules";

/** Where two texts differ: the same before `start`, and the same after each end. */
export function changedRange(before: string, after: string) {
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (start < shorter && before[start] === after[start]) start++;
  let tail = 0;
  while (tail < shorter - start && before[before.length - 1 - tail] === after[after.length - 1 - tail])
    tail++;
  return { start, beforeEnd: before.length - tail, afterEnd: after.length - tail };
}

/**
 * Move findings to match an edit, so underlines stay on their words until the next check answers.
 * A finding the edit touched is dropped: its text is no longer what was checked.
 */
export function shiftFindings(findings: readonly Finding[], before: string, after: string): Finding[] {
  const { start, beforeEnd, afterEnd } = changedRange(before, after);
  const delta = afterEnd - beforeEnd;
  const kept: Finding[] = [];
  for (const finding of findings) {
    if (finding.range.end <= start) kept.push(finding);
    else if (finding.range.start >= beforeEnd) {
      kept.push({
        ...finding,
        range: { start: finding.range.start + delta, end: finding.range.end + delta },
      });
    }
  }
  return kept;
}

const WORD_END = /[\p{L}\p{M}]+$/u;

/** The part of a word that ends at the caret, or null when the caret is not after a word. */
export function wordBefore(text: string, caret: number): { start: number; word: string } | null {
  const match = WORD_END.exec(text.slice(0, caret));
  return match === null ? null : { start: match.index, word: match[0] };
}

/** The variety a word is written in, by its script. */
export const varietyOf = (word: string): Variety => (/\p{Script=Arabic}/u.test(word) ? "ckb" : "kmr");

const HELPER: Readonly<Record<string, string>> = {
  "e^": "ê",
  "i^": "î",
  "u^": "û",
  "s,": "ş",
  "c,": "ç",
  "E^": "Ê",
  "I^": "Î",
  "U^": "Û",
  "S,": "Ş",
  "C,": "Ç",
};

/** The Kurmanji letter spelled by the two characters before the caret, as on a keyboard without them. */
export const helperLetter = (text: string, caret: number): string | undefined =>
  caret < 2 ? undefined : HELPER[text.slice(caret - 2, caret)];
