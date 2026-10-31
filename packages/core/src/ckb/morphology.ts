import {
  CKB_CLITICS,
  CKB_FUNCTION_WORDS_TSV,
  CKB_POS_PRIORITY,
  CKB_PROCLITICS,
  CKB_SLOTS,
} from "../generated/tables.js";
import { length, round, trimEnd, trimStart } from "../python.js";
import {
  type Analysis,
  emptyLexicon,
  type LexiconLike,
  parseFunctionWords,
  segmentation,
} from "../schema.js";
import { normalizeWord } from "./orthography.js";
import { defaultIndex, type FormIndex, PERSONS } from "./verbs.js";

interface Affix {
  form: string;
  tag: string;
  features: Record<string, string>;
  after: "C" | "V" | null;
  posHint: string | null;
}
interface PeeledAffix {
  affix: Affix;
  /** The first slot holding this affix, as an affix may appear in two. */
  slot: string;
}
type Slot = readonly [name: string, affixes: readonly PeeledAffix[]];

const ZWNJ = "‌";
const SOLID_VOWELS = "اەۆێ"; // ا ە ۆ ێ

const firstSlot = new Map<string, string>();
const SLOTS: readonly Slot[] = (CKB_SLOTS as unknown as [string, Affix[]][]).map(([name, affixes]) => [
  name,
  affixes.map((affix) => {
    const key = JSON.stringify(affix);
    if (!firstSlot.has(key)) firstSlot.set(key, name);
    return { affix, slot: firstSlot.get(key) as string };
  }),
]);

let functionWordTable: ReturnType<typeof parseFunctionWords> | undefined;

export function functionWords(): ReturnType<typeof parseFunctionWords> {
  functionWordTable ??= parseFunctionWords(CKB_FUNCTION_WORDS_TSV);
  return functionWordTable;
}

/**
 * Phonological, not orthographic: a final و or ی after a vowel letter is a glide. پیاو and چای end
 * in consonants, while کوردی and دوو end in vowels.
 */
export function endsWithVowel(stem: string): boolean {
  if (stem === "") return false;
  const last = stem.at(-1) as string;
  if (SOLID_VOWELS.includes(last)) return true;
  if (last === "و" || last === "ی") {
    const before = stem.at(-2);
    if (before === last) return true;
    return !(before !== undefined && SOLID_VOWELS.includes(before));
  }
  return false;
}

const after = (stem: string, afterConsonant: string, afterVowel: string) =>
  stem + (endsWithVowel(stem) ? afterVowel : afterConsonant);

/** The nominal forms of a noun, as cell and form. A cell's form is null where it does not exist. */
export function decline(stem: string): [cell: string, form: string | null][] {
  const vowel = endsWithVowel(stem);
  const last = stem.at(-1);
  const glide = vowel && (last === "ی" || last === "ێ");
  const definiteSingular = stem + (glide ? "یەکە" : vowel ? "کە" : "ەکە");
  const definitePlural = stem + (glide ? "یەکان" : vowel ? "کان" : "ەکان");
  return [
    ["bare", stem],
    ["def.sg", definiteSingular],
    ["def.pl", definitePlural],
    ["ind.sg", after(stem, "ێک", "یەک")],
    ["pl", stem.endsWith("ە") ? null : after(stem, "ان", "یان")],
    ["ezafe", `${stem}ی`],
    ["dem", after(stem, "ە", "یە")],
    ["ind.ezafe", after(stem, "ێکی", "یەکی")],
    ["def.sg.add", `${definiteSingular}ش`],
    ...PERSONS.map((p, i): [string, string] => [`def.sg+${p}`, definiteSingular + CKB_CLITICS[i]]),
    ...PERSONS.map((p, i): [string, string] => [`bare+${p}`, stem + CKB_CLITICS[i]]),
  ];
}

type Candidate = [stem: string, segments: PeeledAffix[]];

function peel(word: string, slot: number, segments: PeeledAffix[], out: Candidate[]): void {
  out.push([word, [...segments]]);
  if (out.length > 400) return;
  for (let i = slot; i < SLOTS.length; i++) {
    const [name, affixes] = SLOTS[i] as Slot;
    if (name === "ADD2" && segments.some(({ affix }) => affix.tag === "ADD")) continue;
    for (const peeled of affixes) {
      const { affix } = peeled;
      if (!word.endsWith(affix.form)) continue;
      const stem = word.slice(0, -affix.form.length);
      if (length(stem.replaceAll(ZWNJ, "")) < 2) continue;
      if (affix.after === "C" && endsWithVowel(stem)) continue;
      if (affix.after === "V" && !endsWithVowel(stem)) continue;
      peel(trimEnd(stem, ZWNJ), i + 1, [peeled, ...segments], out);
    }
  }
}

/** Rank-ordered readings of Central Kurdish tokens: every way of peeling suffixes, then scored. */
export class CkbAnalyzer {
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

  private choosePos(stem: string, hint: string | null, inflected: boolean): string {
    const known = new Set(this.lexicon.posOf(stem));
    // An infinitive with nominal suffixes is a verbal noun.
    if (inflected) known.delete("VERB");
    const functionWord = this.fw.get(stem);
    if (functionWord) known.add(functionWord[0]);
    if (hint && (known.has(hint) || known.size === 0)) return hint;
    for (const pos of CKB_POS_PRIORITY) if (known.has(pos)) return pos;
    return hint ?? "NOUN";
  }

  private nominal(word: string, prefix: [string, string][]): Analysis[] {
    const candidates: Candidate[] = [];
    peel(word, 0, [], candidates);
    return candidates.map(([stem, segments]) => {
      const inLexicon = this.lexicon.has(stem);
      let score = this.stemScore(stem);
      const features: Record<string, string> = {};
      let posHint: string | null = null;
      let previousSlot: string | null = null;
      for (const { affix, slot } of segments) {
        const size = length(affix.form);
        score -= 0.4 + (size === 1 && !inLexicon ? 0.5 : 0);
        // Long affixes are rarely accidental string matches.
        score += size >= 3 ? 0.9 : size === 2 ? 0.4 : 0;
        // ەکە+م, ەکان+ی: an enclitic after a definite suffix.
        if (size === 1 && previousSlot === "NUMDEF") score += 0.6;
        previousSlot = slot;
        if ((affix.tag === "NISBA" || affix.tag === "ABST" || affix.tag === "ADVZ") && !inLexicon)
          score -= 1.5;
        Object.assign(features, affix.features);
        posHint ??= affix.posHint;
      }
      let pos = this.choosePos(stem, posHint, segments.length > 0);
      const functionWord = this.fw.get(stem);
      if (functionWord && segments.length === 0) {
        pos = functionWord[0];
        Object.assign(features, functionWord[1]);
      }
      return {
        surface: prefix.map(([morph]) => morph).join("") + word,
        lemma: stem,
        pos,
        features,
        segments: [
          ...prefix,
          [stem, "STEM"],
          ...segments.map(({ affix }): [string, string] => [affix.form, affix.tag]),
        ],
        score: round(score - 0.3 * prefix.length, 3),
      };
    });
  }

  private verbal(word: string): Analysis[] {
    return this.verbs.lookup(word).map((form) => {
      const verb = this.verbs.verbs.get(form.lemma);
      let score =
        (verb === undefined || verb.source === "core" ? 7 : 5.5) + Math.log1p(this.lexicon.freq(word)) / 4;
      const { pos: _pos, ...features } = form.features;
      if (features["form"] === "infinitive") score += 0.2;
      if (verb) features["transitivity"] = verb.transitive ? "transitive" : "intransitive";
      return { surface: word, lemma: form.lemma, pos: "VERB", features, segments: [[word, "VERB"]], score };
    });
  }

  analyze(token: string, normalized = false): Analysis[] {
    const word = normalized ? token : normalizeWord(token);
    if (word === "") return [];
    const results = [...this.verbal(word), ...this.nominal(word, [])];
    for (const [pre, tag] of CKB_PROCLITICS as [string, string][]) {
      const rest = trimStart(word.slice(pre.length), ZWNJ);
      if (word.startsWith(pre) && length(rest) >= 2 && !this.lexicon.has(word) && !this.fw.has(word)) {
        results.push(
          ...this.nominal(rest, [[pre, tag]]).filter((reading) => this.lexicon.has(reading.lemma)),
        );
      }
    }
    const best = new Map<string, Analysis>();
    for (const reading of results) {
      const key = `${segmentation(reading)}\0${reading.pos}`;
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

const ENCLITICS = ["مان", "تان", "یان", "م", "ت", "ی"];
const DEFINITES = ["ەکان", "یەکان", "کان", "ەکە", "یەکە", "کە"];

/** Take off a final pronominal enclitic, longest first. */
export function splitEnclitic(word: string): [stem: string, enclitic: string | null] {
  for (const clitic of ENCLITICS) {
    if (word.endsWith(clitic) && length(word) - length(clitic) >= 2)
      return [word.slice(0, -clitic.length), clitic];
  }
  return [word, null];
}

/** Take off a definiteness suffix. */
export function splitDefinite(word: string): [stem: string, suffix: string | null] {
  for (const suffix of DEFINITES) {
    if (word.endsWith(suffix) && length(word) - length(suffix) >= 2) {
      const stem = word.slice(0, -suffix.length);
      if (suffix.startsWith("ە") || endsWithVowel(stem)) return [stem, suffix];
    }
  }
  return [word, null];
}
