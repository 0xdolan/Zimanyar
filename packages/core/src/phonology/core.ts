import { FRICATIVES, GLIDES, LIQUIDS, NASALS, SIBILANTS, STOPS } from "../generated/tables.js";

/** A symbol and its kind: C consonant (glides included), V written vowel, E epenthetic vowel. */
export type Segment = readonly [symbol: string, kind: "C" | "V" | "E"];

const stops = new Set(STOPS);
const fricatives = new Set(FRICATIVES);
const nasals = new Set(NASALS);
const liquids = new Set(LIQUIDS);
const glides = new Set(GLIDES);
const sibilants = new Set(SIBILANTS);

/** 5 glide, 4 liquid, 3 nasal, 2 fricative, 1 stop or affricate. */
export function sonority(symbol: string): number {
  if (glides.has(symbol)) return 5;
  if (liquids.has(symbol)) return 4;
  if (nasals.has(symbol)) return 3;
  if (fricatives.has(symbol)) return 2;
  return 1;
}

/** Is this cluster a permitted onset, word-initially or word-medially? */
export function legalOnset(cluster: readonly string[], initial: boolean): boolean {
  if (cluster.length <= 1) return true;
  if (cluster.length === 2) {
    const [a, b] = cluster as [string, string];
    if (glides.has(b) && !glides.has(a)) return true;
    return initial && sibilants.has(a) && stops.has(b);
  }
  if (cluster.length === 3 && initial) {
    const [a, b, c] = cluster as [string, string, string];
    return sibilants.has(a) && stops.has(b) && glides.has(c);
  }
  return false;
}

/** Is this cluster a permitted coda, word-finally or word-medially? */
export function legalCoda(cluster: readonly string[], final: boolean): boolean {
  if (cluster.length <= 1) return true;
  if (cluster.length === 2) {
    const [a, b] = cluster as [string, string];
    if (glides.has(a)) return true;
    if (final) return sonority(a) > sonority(b) || (fricatives.has(a) && stops.has(b));
    return stops.has(b) && (fricatives.has(a) || nasals.has(a));
  }
  if (cluster.length === 3 && final) {
    return glides.has(cluster[0] as string) && legalCoda(cluster.slice(1), true);
  }
  return false;
}

const consonants = (symbols: readonly string[]): Segment[] => symbols.map((symbol) => [symbol, "C"]);

/** Turn a vowel-less run into C-e-C syllables, carving from the right. */
function closedSyllables(input: readonly string[], e: string, final: boolean): Segment[] {
  let run = [...input];
  let out: Segment[] = [];
  let first = true;
  while (run.length > 0) {
    if (run.length === 1) {
      out = [[run[0] as string, "C"], [e, "E"], ...out];
      break;
    }
    const takeTwo = first && final && run.length >= 3 && legalCoda(run.slice(-2), true);
    const coda = run.slice(takeTwo ? -2 : -1);
    run = run.slice(0, takeTwo ? -2 : -1);
    const onset = run.at(-1) as string;
    run = run.slice(0, -1);
    out = [[onset, "C"], [e, "E"], ...consonants(coda), ...out];
    first = false;
  }
  return out;
}

/** Insert epenthetic vowels into one maximal consonant run. */
function repairRun(run: readonly string[], leftVowel: boolean, rightVowel: boolean, e: string): Segment[] {
  if (run.length === 0) return [];
  const plain = consonants(run);
  if (leftVowel && rightVowel) {
    for (const k of [2, 1, 0]) {
      if (k > run.length) continue;
      const onset = run.slice(run.length - k);
      const coda = run.slice(0, run.length - k);
      if ((k === 0 || legalOnset(onset, false)) && legalCoda(coda, false)) return plain;
    }
    const onsetSize = run.length >= 2 && legalOnset(run.slice(-2), false) ? 2 : 1;
    const onset = run.slice(-onsetSize);
    const rest = run.slice(0, -onsetSize);
    return [
      ...consonants(rest.slice(0, 1)),
      ...closedSyllables(rest.slice(1), e, false),
      ...consonants(onset),
    ];
  }
  if (leftVowel) {
    if (legalCoda(run, true)) return plain;
    if (run.length >= 3) return [[run[0] as string, "C"], ...closedSyllables(run.slice(1), e, true)];
    const rest = [...run];
    let out: Segment[] = [];
    while (rest.length > 0 && !legalCoda(rest, true)) {
      const c = rest.pop() as string;
      const o = rest.pop();
      out = [...(o === undefined ? [] : consonants([o])), [e, "E"], [c, "C"], ...out];
    }
    return [...consonants(rest), ...out];
  }
  if (rightVowel) {
    if (legalOnset(run, true)) return plain;
    const onsetSize = run.length >= 2 && legalOnset(run.slice(-2), true) ? 2 : 1;
    const onset = run.slice(-onsetSize);
    const prefix = run.slice(0, -onsetSize);
    const head: Segment[] = legalOnset(prefix, true)
      ? [...consonants(prefix), [e, "E"]]
      : [...closedSyllables(prefix.slice(0, -1), e, false), [prefix.at(-1) as string, "C"], [e, "E"]];
    return [...head, ...consonants(onset)];
  }
  if (run.length === 1) return plain;
  return closedSyllables(run, e, true);
}

/** Re-insert unwritten short vowels so that every cluster is legal. */
export function breakClusters(segments: Iterable<Segment>, epenthetic = "ɯ"): Segment[] {
  const out: Segment[] = [];
  let run: string[] = [];
  let leftVowel = false;
  for (const [symbol, kind] of segments) {
    if (kind === "C") {
      run.push(symbol);
      continue;
    }
    out.push(...repairRun(run, leftVowel, true, epenthetic));
    run = [];
    out.push([symbol, kind]);
    leftVowel = true;
  }
  out.push(...repairRun(run, leftVowel, false, epenthetic));
  return out;
}

/** Split a repaired segment list into syllables, with the longest legal onset. */
export function syllabify(segments: readonly Segment[]): Segment[][] {
  const nuclei: number[] = [];
  segments.forEach(([, kind], i) => {
    if (kind === "V" || kind === "E") nuclei.push(i);
  });
  if (nuclei.length === 0) return [[...segments]];
  const bounds = [0];
  for (let n = 0; n + 1 < nuclei.length; n++) {
    const a = nuclei[n] as number;
    const b = nuclei[n + 1] as number;
    const between = segments.slice(a + 1, b).map(([symbol]) => symbol);
    let split = a + 1;
    for (let k = between.length; k >= 0; k--) {
      if (legalOnset(between.slice(between.length - k), false)) {
        split = b - k;
        break;
      }
    }
    bounds.push(split);
  }
  bounds.push(segments.length);
  const out: Segment[][] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const [x, y] = [bounds[i] as number, bounds[i + 1] as number];
    if (y > x) out.push(segments.slice(x, y));
  }
  return out;
}
