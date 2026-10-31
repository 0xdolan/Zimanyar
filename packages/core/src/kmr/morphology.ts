import {
  KMR_DECLENSION,
  KMR_DERIVATIONS,
  KMR_FUNCTION_WORDS_TSV,
  KMR_INFLECTIONS,
  KMR_POS_PRIORITY,
  KMR_VOWELS,
} from "../generated/tables.js";
import { length, round } from "../python.js";
import {
  type Analysis,
  emptyLexicon,
  type LexiconLike,
  parseFunctionWords,
  segmentation,
} from "../schema.js";
import { lower, normalizeWord } from "./orthography.js";
import { defaultIndex, type FormIndex } from "./verbs.js";

type Features = Record<string, string>;
type Inflection = [suffix: string, tag: string, features: Features, needs: "C" | "V" | null];
type Derivation = [suffix: string, tag: string, pos: string];
type Cell = [cell: string, afterConsonant: string | null, afterVowel: string | null];
export type Gender = "f" | "m";

const vowels = new Set(KMR_VOWELS);
const INFLECTIONS = KMR_INFLECTIONS as unknown as Inflection[];
const DERIVATIONS = KMR_DERIVATIONS as unknown as Derivation[];
const DECLENSION = KMR_DECLENSION as unknown as Record<Gender, Cell[]>;
const AMBIGUOUS_INDEFINITE = "INDEF.OBL.M|INDEF.EZ.M";
const AMBIGUOUS_EZAFE = "EZ.M|OBL.F";

let functionWordTable: ReturnType<typeof parseFunctionWords> | undefined;

export function functionWords(): ReturnType<typeof parseFunctionWords> {
  functionWordTable ??= parseFunctionWords(KMR_FUNCTION_WORDS_TSV);
  return functionWordTable;
}

/** Join a stem and a suffix; a final î shortens to i before y: xanî + yê gives xaniyê. */
export function attach(stem: string, suffix: string): string {
  return stem.endsWith("î") && suffix.startsWith("y") ? `${stem.slice(0, -1)}i${suffix}` : stem + suffix;
}

/** All forms of a noun of a gender, as cell and form. A cell's form is null where it does not exist. */
export function decline(stem: string, gender: Gender): [cell: string, form: string | null][] {
  const vowelFinal = vowels.has(stem.at(-1) as string);
  return DECLENSION[gender].map(([cell, afterConsonant, afterVowel]) => {
    const suffix = vowelFinal ? afterVowel : afterConsonant;
    return [cell, suffix === null ? null : attach(stem, suffix)];
  });
}

function meetsCondition(stem: string, needs: "C" | "V" | null): boolean {
  if (needs === null || stem === "") return stem !== "";
  const vowelFinal = vowels.has(stem.at(-1) as string);
  return needs === "V" ? vowelFinal : !vowelFinal;
}

type Candidate = [stem: string, segments: [string, string][], features: Features, posHint: string | null];

function candidates(word: string): Candidate[] {
  const out: Candidate[] = [[word, [], {}, null]];
  const size = length(word);
  for (const [suffix, tag, features, needs] of INFLECTIONS) {
    if (!word.endsWith(suffix) || size - length(suffix) < 2) continue;
    const stem = word.slice(0, -suffix.length);
    if (!meetsCondition(stem, needs)) continue;
    out.push([stem, [[suffix, tag]], { ...features }, "NOUN"]);
    // xani+yê comes from xanî.
    if (suffix.startsWith("y") && stem.endsWith("i")) {
      out.push([`${stem.slice(0, -1)}î`, [[suffix, tag]], { ...features }, "NOUN"]);
    }
    for (const [derivation, derivationTag, pos] of DERIVATIONS) {
      if (stem.endsWith(derivation) && length(stem) - length(derivation) >= 2) {
        out.push([
          stem.slice(0, -derivation.length),
          [
            [derivation, derivationTag],
            [suffix, tag],
          ],
          { ...features },
          pos,
        ]);
      }
    }
  }
  for (const [derivation, tag, pos] of DERIVATIONS) {
    if (word.endsWith(derivation) && size - length(derivation) >= 2) {
      out.push([word.slice(0, -derivation.length), [[derivation, tag]], {}, pos]);
    }
  }
  return out;
}

function affixCost(form: string): number {
  const size = length(form);
  return -0.4 + (size >= 3 ? 0.9 : size === 2 ? 0.4 : -0.5);
}

/** Rank-ordered readings of Kurmanji tokens. Ambiguity is kept: -ê is m ezafe or f oblique. */
export class KmrAnalyzer {
  private readonly fw = functionWords();

  constructor(
    private readonly lexicon: LexiconLike = emptyLexicon,
    private readonly verbs: FormIndex = defaultIndex(),
  ) {}

  private stemScore(stem: string): number {
    if (this.fw.has(stem)) return 4;
    if (this.lexicon.has(stem)) return 5 + Math.log1p(this.lexicon.freq(stem)) / 4;
    const frequency = this.lexicon.freq(stem);
    return -3 + (frequency ? Math.log1p(frequency) / 3 : 0);
  }

  /** Split the -ê and -ekî ambiguities, using the gender in the lexicon where there is one. */
  private resolveGender(stem: string, tag: string, features: Features): Features[] {
    const gender = this.lexicon.genderOf(stem);
    const known: Features = gender && !("gender" in features) ? { ...features, gender } : features;
    if (tag === AMBIGUOUS_INDEFINITE)
      return [
        { ...known, case: "obl" },
        { ...known, ezafe: "yes" },
      ];
    if (tag !== AMBIGUOUS_EZAFE) return [known];
    if (gender === "f") return [{ ...known, case: "obl" }];
    if (gender === "m") return [{ ...known, ezafe: "yes" }];
    return [
      { ...known, case: "obl", gender: "f" },
      { ...known, ezafe: "yes", gender: "m" },
    ];
  }

  analyze(token: string, normalized = false): Analysis[] {
    const word = normalized ? lower(token) : normalizeWord(token);
    if (word === "") return [];
    const results: Analysis[] = [];
    for (const form of this.verbs.lookup(word)) {
      const verb = this.verbs.verbs.get(form.lemma);
      const { pos: _pos, ...features } = form.features;
      if (verb) {
        features["transitivity"] = verb.transitive ? "transitive" : "intransitive";
        features["past_stem"] = verb.past;
        features["present_stem"] = verb.present;
      }
      let score =
        (verb === undefined || verb.source === "core" ? 7 : 5.5) + Math.log1p(this.lexicon.freq(word)) / 4;
      // The citation form beats the homographic 3pl past.
      if (features["form"] === "infinitive") score += 0.2;
      results.push({
        surface: word,
        lemma: form.lemma,
        pos: "VERB",
        features,
        segments: [[word, "VERB"]],
        score,
      });
    }
    for (const [stem, segments, candidateFeatures, posHint] of candidates(word)) {
      let features = candidateFeatures;
      let affixes = 0;
      for (const [form] of segments) affixes += affixCost(form);
      let score = this.stemScore(stem) + affixes;
      const known = new Set(this.lexicon.posOf(stem));
      const functionWord = this.fw.get(stem);
      if (functionWord) known.add(functionWord[0]);
      // An infinitive with a case suffix is a verbal noun.
      if (segments.length > 0) known.delete("VERB");
      const gender = this.lexicon.genderOf(stem);
      const tag = segments.at(-1)?.[1] ?? "";
      // For example -a, the feminine ezafe, on a masculine noun.
      if (gender && features["gender"] && features["gender"] !== gender) score -= 2;
      if (
        posHint === "NOUN" &&
        known.size > 0 &&
        !known.has("NOUN") &&
        !known.has("PROPN") &&
        !known.has("ADJ")
      ) {
        score -= 1;
      }
      let pos: string =
        posHint && (known.size === 0 || known.has(posHint))
          ? posHint
          : (KMR_POS_PRIORITY.find((p) => known.has(p)) ?? posHint ?? "NOUN");
      if (segments.length === 0 && functionWord) {
        pos = functionWord[0];
        features = { ...features, ...functionWord[1] };
      }
      for (const resolved of this.resolveGender(stem, tag, features)) {
        results.push({
          surface: word,
          lemma: stem,
          pos,
          features: resolved,
          segments: [[stem, "STEM"], ...segments],
          score: round(score, 3),
        });
      }
    }
    const best = new Map<string, Analysis>();
    for (const reading of results) {
      const sorted = Object.entries(reading.features).sort(([a], [b]) => (a < b ? -1 : 1));
      const key = JSON.stringify([segmentation(reading), reading.pos, sorted]);
      const existing = best.get(key);
      if (existing === undefined || reading.score > existing.score) best.set(key, reading);
    }
    // A stable sort: equal scores stay in the order they were first found, as in zimankit.
    return [...best.values()].sort((a, b) => b.score - a.score);
  }

  best(token: string): Analysis | null {
    return this.analyze(token)[0] ?? null;
  }

  lemmatize(token: string): string {
    return this.best(token)?.lemma ?? token;
  }
}
