import { CHAR_SCRIPT_RUNS, CKB_LETTER_CLASS, KMR_LETTER_CLASS, PATTERNS } from "./generated/tables.js";
import { pythonRegex } from "./python.js";

export { CKB_LETTER_CLASS, KMR_LETTER_CLASS, PATTERNS };

export type Script = "arabic" | "latin" | "cyrillic" | "mixed" | "none";

export type PatternName = keyof typeof PATTERNS;

/** A pattern of the regex cookbook, compiled. */
export function pattern(name: PatternName, flags = ""): RegExp {
  return pythonRegex(PATTERNS[name], flags);
}

const ZWNJ = "\u200c";
const runs = CHAR_SCRIPT_RUNS as unknown as readonly (readonly [
  number,
  number,
  "arabic" | "latin" | "cyrillic",
])[];

/**
 * The script of one character. zimankit decides from the character's Unicode name, which
 * JavaScript cannot read, so its answers are generated as sorted runs of code points. That also
 * keeps the result the same whichever Unicode version the runtime has.
 */
export function charScript(character: string): "joiner" | "arabic" | "latin" | "cyrillic" | "other" {
  if (character === ZWNJ) return "joiner";
  const code = character.codePointAt(0) as number;
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [from, to, script] = runs[middle] as (typeof runs)[number];
    if (code < from) high = middle - 1;
    else if (code > to) low = middle + 1;
    else return script;
  }
  return "other";
}

/** The dominant script of a text: at least 80 % of its letters. */
export function detectScript(text: string): Script {
  const counts = { arabic: 0, latin: 0, cyrillic: 0 };
  let total = 0;
  for (const character of text) {
    const script = charScript(character);
    if (script === "arabic" || script === "latin" || script === "cyrillic") {
      counts[script]++;
      total++;
    }
  }
  if (total === 0) return "none";
  let best: keyof typeof counts = "arabic";
  if (counts.latin > counts[best]) best = "latin";
  if (counts.cyrillic > counts[best]) best = "cyrillic";
  return counts[best] / total >= 0.8 ? best : "mixed";
}

/** Levenshtein distance over code points. */
export function levenshtein(first: string, second: string): number {
  if (first === second) return 0;
  let a = Array.from(first);
  let b = Array.from(second);
  if (a.length < b.length) [a, b] = [b, a];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  a.forEach((ca, i) => {
    const current = [i + 1];
    b.forEach((cb, j) => {
      current.push(
        Math.min(
          (previous[j + 1] as number) + 1,
          (current[j] as number) + 1,
          (previous[j] as number) + (ca === cb ? 0 : 1),
        ),
      );
    });
    previous = current;
  });
  return previous[b.length] as number;
}

/** Optimal string alignment: Levenshtein plus transposition of neighbours. */
export function damerauLevenshtein(first: string, second: string): number {
  const a = Array.from(first);
  const b = Array.from(second);
  const row = (length: number) => new Array<number>(length).fill(0);
  const d = Array.from({ length: a.length + 1 }, () => row(b.length + 1));
  const at = (i: number, j: number) => (d[i] as number[])[j] as number;
  for (let i = 0; i <= a.length; i++) (d[i] as number[])[0] = i;
  for (let j = 0; j <= b.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      (d[i] as number[])[j] = best;
    }
  }
  return at(a.length, b.length);
}

const CONFUSABLE_PAIRS = new Set(
  [
    "رڕ", // reh and rreh
    "لڵ", // lam and llam
    "یێ", // yeh and long e
    "وۆ", // waw and oe
    "ەه", // ae and heh
    "کك", // keheh and Arabic kaf
    "یي", // Farsi yeh and Arabic yeh
    "eê",
    "iî",
    "uû",
    "sş",
    "cç",
  ].flatMap((pair) => {
    const [x, y] = Array.from(pair) as [string, string];
    return [`${x}\0${y}`, `${y}\0${x}`];
  }),
);

/** Whether writers confuse these two letters, which makes swapping them a cheap edit. */
export const isConfusable = (a: string, b: string): boolean => CONFUSABLE_PAIRS.has(`${a}\0${b}`);

/** Levenshtein distance where letters that writers confuse cost less to swap. */
export function weightedDistance(first: string, second: string, confusableCost = 0.3): number {
  const a = Array.from(first);
  const b = Array.from(second);
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  a.forEach((ca, i) => {
    const current = [i + 1];
    b.forEach((cb, j) => {
      const swap = ca === cb ? 0 : CONFUSABLE_PAIRS.has(`${ca}\0${cb}`) ? confusableCost : 1;
      current.push(
        Math.min((previous[j + 1] as number) + 1, (current[j] as number) + 1, (previous[j] as number) + swap),
      );
    });
    previous = current;
  });
  return previous[b.length] as number;
}
