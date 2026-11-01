import {
  CKB_CLITIC_ADPOSITIONS,
  CKB_CLITICS,
  CKB_DERIV_PREFIXES,
  CKB_DERIVED_TAGS,
  CKB_ENCLITIC_TAGS,
  CKB_FULL_SCORE_WORDS,
  CKB_FUNCTION_WORDS_TSV,
  CKB_INTERFIXES,
  CKB_POS_PRIORITY,
  CKB_PREVERBS,
  CKB_PROCLITICS,
  CKB_SLOTS,
} from "../generated/tables.js";
import { length, round, trimEnd, trimStart } from "../python.js";
import {
  type Analysis,
  emptyLexicon,
  gloss,
  type LexiconLike,
  parseFunctionWords,
  segmentation,
} from "../schema.js";
import { normalizeWord } from "./orthography.js";
import { defaultIndex, type FormIndex, PERSONS, type VerbForm } from "./verbs.js";

interface Affix {
  form: string;
  tag: string;
  features: Record<string, string>;
  after: "C" | "V" | "UU" | "DA" | null;
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

const fullScoreWords = new Set<string>(CKB_FULL_SCORE_WORDS);
const derivedTags = new Set<string>(CKB_DERIVED_TAGS);
const cliticAdpositions: readonly string[] = CKB_CLITIC_ADPOSITIONS;
const encliticTags = new Set<string>(CKB_ENCLITIC_TAGS);
const SHORT_DERIVATIONS = new Set(["گەر", "چی", "وان", "ساز", "مەند", "ناک", "خانە"]);
const SHORT_STEM_TAGS = new Set(["AGENT", "POSSR", "DIM", "SCIENCE"]);
const OPEN_TAGS = new Set(["NISBA", "ABST", "ADVZ", "SCIENCE", "DIM"]);
const CLOSED_POS = new Set(["PRON", "DET", "NUM"]);

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
  // وو takes the consonant endings: خانووەکە, خانووێک, خانووان
  const uu = stem.endsWith("وو");
  const vowel = endsWithVowel(stem) && !uu;
  const last = stem.at(-1);
  const glide = vowel && (last === "ی" || last === "ێ");
  const definiteSingular = stem + (glide ? "یەکە" : vowel ? "کە" : "ەکە");
  const definitePlural = stem + (glide ? "یەکان" : vowel ? "کان" : "ەکان");
  const ending = (afterConsonant: string, afterVowel: string) =>
    uu ? stem + afterConsonant : after(stem, afterConsonant, afterVowel);
  return [
    ["bare", stem],
    ["def.sg", definiteSingular],
    ["def.pl", definitePlural],
    ["ind.sg", ending("ێک", "یەک")],
    ["pl", stem.endsWith("ە") ? null : ending("ان", "یان")],
    ["ezafe", `${stem}ی`],
    ["dem", ending("ە", "یە")],
    ["ind.ezafe", ending("ێکی", "یەکی")],
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
      if (affix.after === "UU" && !stem.endsWith("وو")) continue;
      // ماڵ+دا+م, not سە+دا+م
      if (affix.after === "DA" && (!stem.endsWith("دا") || length(stem) < 5)) continue;
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
    if (this.fw.has(stem) && !fullScoreWords.has(stem)) return 4;
    if (this.lexicon.has(stem)) return 5 + Math.log1p(this.lexicon.freq(stem)) / 4;
    if (this.fw.has(stem)) return 4;
    const frequency = this.lexicon.freq(stem);
    return -3 + (frequency ? Math.log1p(frequency) / 3 : 0);
  }

  private choosePos(stem: string, hint: string | null, inflected: boolean): string {
    const functionWord = this.fw.get(stem);
    // ئەوانە+ی stays a pronoun.
    if (functionWord && CLOSED_POS.has(functionWord[0])) return functionWord[0];
    const known = new Set(this.lexicon.posOf(stem));
    // An infinitive with nominal suffixes is a verbal noun.
    if (inflected) known.delete("VERB");
    if (functionWord) known.add(functionWord[0]);
    if (hint && (known.has(hint) || known.size === 0)) return hint;
    for (const pos of CKB_POS_PRIORITY) if (known.has(pos)) return pos;
    return hint ?? "NOUN";
  }

  private nominal(word: string, prefix: [string, string][]): Analysis[] {
    const candidates: Candidate[] = [];
    peel(word, 0, [], candidates);
    return candidates.map(([peeledStem, segments]) => {
      let stem = peeledStem;
      const inLexicon = this.lexicon.has(stem);
      let score = this.stemScore(stem);
      const features: Record<string, string> = {};
      let posHint: string | null = null;
      let previousSlot: string | null = null;
      for (const peeled of segments) {
        const { affix, slot } = peeled;
        const { form, tag } = affix;
        const size = length(form);
        score -= 0.4 + (size === 1 && !inLexicon ? 0.5 : 0);
        // Long affixes are rarely accidental string matches.
        score += size >= 3 ? 0.9 : size === 2 ? 0.4 : 0;
        // ەکە+م, ەکان+ی: an enclitic after a definite suffix.
        if (size === 1 && previousSlot === "NUMDEF") score += 0.6;
        previousSlot = slot;
        if (OPEN_TAGS.has(tag) && !inLexicon) score -= 1.5;
        // Short and easily accidental.
        if (SHORT_DERIVATIONS.has(form) && !inLexicon) score -= 3;
        // سە+یلە+م is not a diminutive.
        if (SHORT_STEM_TAGS.has(tag) && form !== "کار" && form !== "دار" && length(stem) < 3) score -= 12;
        // پیاوێکە is پیاو+ێک+ە.
        if ((form === "ێکە" || form === "ێکان") && !this.lexicon.has(`${stem}ی`)) score -= 12;
        // بێ+کار is the prefix, not a preposition with an agent suffix.
        if (derivedTags.has(tag) && this.fw.has(stem)) score -= 6;
        const upTo = segments.findIndex((other) => other.affix === affix);
        const inner =
          stem +
          segments
            .slice(0, upTo + 1)
            .map((other) => other.affix.form)
            .join("");
        // A listed word stays whole: کوردستان+ە, not کورد+ستان+ە.
        if ((slot === "DERIV" || slot === "PL0") && this.lexicon.has(inner)) score -= 3;
        // هەندێک+یش, not هەند+ێک+یش.
        if (this.fw.has(inner) && !this.fw.has(stem)) score -= 3;
        // Short and easily accidental: لە+سێ, not لەس+ێ.
        if (form === "ێ" || form === "ەک") score -= inLexicon ? 1.5 : 3.5;
        // Final only: سەرەک+ی, not سەر+ەک+ی.
        if (form === "ەک" && peeled !== segments.at(-1)) score -= 6;
        // After ا it is ایی or a listed word: کۆتایی; یی follows ە ۆ ێ: سنەیی, شنۆیی.
        if (form === "یی" && stem.endsWith("ا")) score -= 12;
        // ڕەش+ایی, not کۆت+ایی.
        if (form === "ایی" && !this.lexicon.posOf(stem).has("ADJ")) score -= 12;
        // A typo for لەگەڵ, not لە+گەل.
        if (tag === "PL.GEL" && this.fw.has(stem)) score -= 6;
        // A listed word stays whole.
        if (tag === "E" && (this.lexicon.has(word) || this.fw.has(word))) score -= 3;
        // A verb is a verb: بووە, کردە, نیشاندام.
        if (
          (tag === "E" || tag.startsWith("COP")) &&
          (this.verbs.lookup(word).length > 0 || this.verbs.lookup(word.slice(0, -form.length)).length > 0)
        ) {
          score -= 12;
        }
        Object.assign(features, affix.features);
        posHint ??= affix.posHint;
      }
      const tags = segments.map(({ affix }) => affix);
      // The listed word behind a changed stem: ماس+ێکە is ماسی, پەنجەر+ان is پەنجەرە.
      if (tags.some(({ form }) => form === "ێکە" || form === "ێکان") && this.lexicon.has(`${stem}ی`)) {
        stem += "ی";
      } else if (
        !this.lexicon.has(stem) &&
        this.lexicon.has(`${stem}ە`) &&
        tags.some(({ tag }) => tag === "PL")
      ) {
        score += this.stemScore(`${stem}ە`) - this.stemScore(stem);
        stem += "ە";
      }
      let pos = this.choosePos(stem, posHint, segments.length > 0);
      const functionWord = this.fw.get(stem);
      if (functionWord && segments.length === 0) {
        pos = functionWord[0];
        Object.assign(features, functionWord[1]);
      } else if (cliticAdpositions.includes(stem) && tags.every(({ tag }) => encliticTags.has(tag))) {
        pos = "ADP";
        features["adptype"] = "bare";
        score += 5;
      }
      const written =
        segments.length > 0
          ? word.slice(0, word.length - tags.reduce((total, { form }) => total + form.length, 0))
          : stem;
      return {
        surface: prefix.map(([morph]) => morph).join("") + word,
        lemma: stem,
        pos,
        features,
        segments: [
          ...prefix,
          [written, "STEM"],
          ...segments.map(({ affix }): [string, string] => [affix.form, affix.tag]),
        ],
        score: round(score - 0.3 * prefix.length, 3),
      };
    });
  }

  /** بە+خێرا+یی, بە+جوان+ی: the adverbs of manner, when the middle is a known word. */
  private manner(word: string): Analysis[] {
    const out: Analysis[] = [];
    if (!word.startsWith("بە")) return out;
    for (const end of ["یی", "ی"]) {
      const stem = word.slice(2, -end.length);
      const known = this.lexicon.posOf(stem);
      if (word.endsWith(end) && length(stem) >= 3 && (known.has("ADJ") || known.has("NOUN"))) {
        out.push({
          surface: word,
          lemma: stem,
          pos: "ADV",
          features: { derivation: "manner" },
          segments: [
            ["بە", "CONFIX.BE"],
            [stem, "STEM"],
            [end, "CONFIX.Y"],
          ],
          score: this.stemScore(stem) - 0.3,
        });
      }
    }
    return out;
  }

  /** Two clitics on one adposition: بۆ+م+ی (بۆمی نووسی "he wrote to me"). */
  private stackedAdposition(word: string): Analysis[] {
    const out: Analysis[] = [];
    const clitics = CKB_CLITICS as readonly string[];
    for (const host of cliticAdpositions) {
      if (!word.startsWith(host)) continue;
      const rest = word.slice(host.length);
      for (const first of clitics) {
        const second = rest.slice(first.length);
        if (rest.startsWith(first) && clitics.includes(second)) {
          out.push({
            surface: word,
            lemma: host,
            pos: "ADP",
            features: { adptype: "bare" },
            segments: [
              [host, "STEM"],
              [first, "CLITIC"],
              [second, "CLITIC"],
            ],
            score: 8,
          });
        }
      }
    }
    return out;
  }

  /** بێ+کار, ها+و: only when the remainder is a known word. */
  private prefixed(word: string): Analysis[] {
    const out: Analysis[] = [];
    for (const [pre, tag] of CKB_DERIV_PREFIXES as [string, string][]) {
      const rest = word.slice(pre.length);
      if (word.startsWith(pre) && length(rest) >= 2 && this.lexicon.has(rest)) {
        out.push({
          surface: word,
          lemma: word,
          pos: "ADJ",
          features: { derivation: tag.toLowerCase() },
          segments: [
            [pre, tag],
            [rest, "STEM"],
          ],
          score: this.stemScore(rest) - 0.3,
        });
      }
    }
    return out;
  }

  /** Two known content words, with or without a linker. Scored below any known or function stem. */
  private compound(word: string): Analysis[] {
    const out: Analysis[] = [];
    for (let i = 2; i < length(word) - 1; i++) {
      const left = word.slice(0, i);
      if (!this.lexicon.has(left) || this.fw.has(left)) continue;
      for (const link of CKB_INTERFIXES as string[]) {
        const right = word.slice(i + link.length);
        if (
          word.startsWith(link, i) &&
          length(right) >= 2 &&
          this.lexicon.has(right) &&
          !this.fw.has(right)
        ) {
          out.push({
            surface: word,
            lemma: word,
            pos: "NOUN",
            features: { compound: link || "zero" },
            segments: [
              [left, "STEM"],
              ...(link ? ([[link, "LINK"]] as [string, string][]) : []),
              [right, "STEM"],
            ],
            score: 3,
          });
        }
      }
    }
    return out;
  }

  /**
   * Forms with a pronoun object: دەتبینم, هەڵیدەگرم, بمگرە, بینیمیت, گرتمی, بردینیان. They multiply the paradigm
   * by six, so they are recognised by stripping the object and looking the rest up, not listed. A reading needs
   * a transitive verb, and a first or second person object must differ from the subject.
   */
  private objectClitic(word: string): [form: VerbForm, object: string][] {
    const found: [VerbForm, string][] = [];
    const verbOf = (form: VerbForm) =>
      this.verbs.verbs.get(form.lemma) as NonNullable<ReturnType<typeof this.verbs.verbs.get>>;
    const transitive = (form: string, coreOnly: boolean) =>
      this.verbs.lookup(form).filter((f) => {
        const verb = verbOf(f);
        return verb.transitive && (verb.source === "core" || !coreOnly);
      });
    const add = (
      form: string,
      object: string,
      ok: (features: Record<string, string>) => boolean,
      coreOnly: boolean,
    ) => {
      for (const f of transitive(form, coreOnly)) {
        // "I see me" needs خۆ; only a third person can differ from a subject of the same person.
        const subject = f.features["person"] ?? f.features["agent"] ?? "None";
        if (ok(f.features) && (object.startsWith("3") || !subject.includes(object))) found.push([f, object]);
      }
    };
    const isPresent = (features: Record<string, string>, clitic: string) => {
      // No "see yourself" order.
      if (features["mood"] === "imperative") return clitic !== "ت" && clitic !== "تان";
      return features["tense"] === "present" && !("voice" in features) && "person" in features;
    };
    const isPast = (features: Record<string, string>) =>
      features["tense"] === "past" &&
      features["aspect"] === "perfective" &&
      !("polarity" in features) &&
      !("voice" in features);

    for (const [i, clitic] of (CKB_CLITICS as string[]).entries()) {
      const object = PERSONS[i] as string;
      // دە+ت+بینم, بم+گرە, and on a preverb هەڵ+ی+دەگرم, ڕا+م+بهێنە
      for (const head of ["دە", "نا", "ب", "نە", "مە", ...(CKB_PREVERBS as string[])]) {
        const rest = word.slice(head.length + clitic.length);
        if (word.startsWith(head + clitic) && length(rest) >= 2) {
          // A short remainder is too easily another word on a guessed verb: دەیلی
          add(head + rest, object, (features) => isPresent(features, clitic), length(rest) < 4);
        }
      }
    }
    for (const [end, object] of [
      ["یت", "2sg"],
      ["م", "1sg"],
      ["ین", "1pl"],
      ["یان", "3pl"],
      ["ن", "2pl|3pl"],
    ] as const) {
      // بینیم+یت, ڕامهێنا+یت. Core verbs only: on guessed ones these match other words (بریتین, بریتانی, درامی).
      if (word.endsWith(end) && length(word) > length(end) + 2) {
        add(
          word.slice(0, -end.length),
          object,
          (features) =>
            isPast(features) && ["1sg", "2sg", "1pl", "2pl"].includes(features["agent"] as string),
          true,
        );
      }
    }
    for (const [agent, clitic] of [
      ["3sg", "ی"],
      ["3pl", "یان"],
    ] as const) {
      // گرت+م+ی, برد+ین+یان
      if (!word.endsWith(clitic)) continue;
      const bare = word.slice(0, -clitic.length);
      for (const [end, object] of [
        ["مان", "1pl"],
        ["تان", "2pl"],
        ["م", "1sg"],
        ["ت", "2sg"],
        ["ین", "1pl"],
        ["یت", "2sg"],
      ] as const) {
        if (bare.endsWith(end) && length(bare) > length(end) + 1) {
          for (const f of transitive(bare.slice(0, -end.length), true)) {
            if (isPast(f.features) && f.features["agent"] === "external") {
              found.push([{ form: f.form, lemma: f.lemma, features: { ...f.features, agent } }, object]);
            }
          }
        }
      }
    }
    return found;
  }

  private verbal(word: string): Analysis[] {
    const out: Analysis[] = [];
    const listed = this.verbs.lookup(word).length > 0;
    const known = this.lexicon.has(word) || this.fw.has(word);
    const withoutPos = (features: Record<string, string>) => {
      const { pos: _pos, ...rest } = features;
      return rest;
    };
    if (!listed && !known) {
      for (const [form, object] of this.objectClitic(word)) {
        out.push({
          surface: word,
          lemma: form.lemma,
          pos: "VERB",
          features: { ...withoutPos(form.features), object, transitivity: "transitive" },
          segments: [[word, "VERB"]],
          score: this.verbs.verbs.get(form.lemma)?.source === "core" ? 6 : 4.5,
        });
      }
    }
    if (out.length === 0 && !listed && word.startsWith("ئە") && !known) {
      // ئەچم, ئەخوارد: the eastern marker, recognised and never generated.
      for (const form of this.verbs.lookup(`دە${word.slice(2)}`)) {
        if (this.verbs.verbs.get(form.lemma)?.source === "core") {
          out.push({
            surface: word,
            lemma: form.lemma,
            pos: "VERB",
            features: { ...withoutPos(form.features), variant: "dialect_ae" },
            segments: [[word, "VERB"]],
            score: 6,
          });
        }
      }
    }
    const forms = this.verbs.lookup(word);
    for (const form of forms) {
      // A verb guessed from a function word: یان.
      if (this.fw.has(form.lemma)) continue;
      const verb = this.verbs.verbs.get(form.lemma);
      let score =
        (verb === undefined || verb.source === "core" ? 7 : 5.5) + Math.log1p(this.lexicon.freq(word)) / 4;
      const functionWord = this.fw.get(word);
      // بێ the adposition, برا "brother".
      if (functionWord && (form.features["variant"] || functionWord[0] === "NOUN")) score -= 4;
      const rivals = forms.some((other) => other.lemma !== form.lemma);
      const agent = form.features["agent"];
      // A listed verb wins: دیاریکرد is دیاریکردن, not دیار+ی+کرد.
      if (verb?.light && rivals && agent !== undefined && agent !== "external") score -= 0.5;
      const features = withoutPos(form.features);
      if (features["form"] === "infinitive") score += 0.2;
      if (verb) features["transitivity"] = verb.transitive ? "transitive" : "intransitive";
      out.push({
        surface: word,
        lemma: form.lemma,
        pos: "VERB",
        features,
        segments: [[word, "VERB"]],
        score,
      });
    }
    return out;
  }

  analyze(token: string, normalized = false): Analysis[] {
    const word = normalized ? token : normalizeWord(token);
    if (word === "") return [];
    const results = [...this.verbal(word), ...this.nominal(word, [])];
    const known = this.lexicon.has(word) || this.fw.has(word);
    for (const [pre, tag] of CKB_PROCLITICS as [string, string][]) {
      const rest = trimStart(word.slice(pre.length), ZWNJ);
      if (word.startsWith(pre) && length(rest) >= 2 && !known) {
        results.push(
          ...this.nominal(rest, [[pre, tag]]).filter((reading) => this.lexicon.has(reading.lemma)),
        );
      }
    }
    if (!known && this.verbs.lookup(word).length === 0) {
      results.push(
        ...this.prefixed(word),
        ...this.compound(word),
        ...this.stackedAdposition(word),
        ...this.manner(word),
      );
    }
    const best = new Map<string, Analysis>();
    for (const reading of results) {
      const key = `${segmentation(reading)}\0${gloss(reading)}\0${reading.pos}`;
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
