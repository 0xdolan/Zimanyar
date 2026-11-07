import { type Course, declension, referenceVerbs, VOCABULARY, verbTable } from "@zimanyar/content";
import { normalize } from "@zimanyar/core";
import { allRuleMeta, type LessonRef } from "@zimanyar/rules";
import lessons from "@zimanyar/rules/lessons.json" with { type: "json" };

export type DrillKind = "verb" | "noun" | "spot";

interface DrillBase {
  /** Stable across releases: spaced repetition remembers drills by it. */
  id: string;
  lang: Course;
  /** Where to read about it. */
  lesson: LessonRef;
}

/** Fill in a verb form in a short sentence. */
export interface VerbDrill extends DrillBase {
  kind: "verb";
  verb: string;
  meaning: string;
  cell: VerbCell;
  person: string;
  /** The sentence around the gap. */
  before: string;
  after: string;
  answer: string;
  /** Other spellings that are right too, such as a split form written solid. */
  alternatives: string[];
}

/** Give one form of a noun. */
export interface NounDrill extends DrillBase {
  kind: "noun";
  noun: string;
  meaning: string;
  /** Kurmanji nouns are feminine or masculine. */
  gender?: "f" | "m";
  cell: NounCell;
  answer: string;
  alternatives: string[];
}

/** Choose the right one of two sentences, from a rule's examples. */
export interface SpotDrill extends DrillBase {
  kind: "spot";
  rule: string;
  choices: [string, string];
  answer: string;
  gloss?: string;
}

export type Drill = VerbDrill | NounDrill | SpotDrill;

export const VERB_CELLS = [
  "present",
  "present_neg",
  "past",
  "past_neg",
  "subj",
  "imperative",
  "past_prog",
  "perfect",
] as const;
export type VerbCell = (typeof VERB_CELLS)[number];

export const NOUN_CELLS = {
  ckb: ["def.sg", "ind.sg", "def.pl", "ezafe", "ind.ezafe", "bare+1sg"],
  kmr: ["def.obl.sg", "def.ez.sg", "ind.dir.sg", "ind.ez.sg", "def.obl.pl", "def.ez.pl"],
} as const;
export type NounCell = (typeof NOUN_CELLS)[Course][number];

/** The verbs drilled, from the most common: the reference verbs come in the order the courses teach them. */
const VERBS_DRILLED = 24;
const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const IMPERATIVE_PERSONS = ["2sg", "2pl"];

type Anchor = readonly [lessonId: number, anchor: string];

/** The lesson section that teaches each form. Tests check that every anchor exists. */
const VERB_LESSONS: Record<Course, Record<VerbCell, Anchor> & { transitivePast: Anchor }> = {
  ckb: {
    present: [10, "building-the-present"],
    present_neg: [10, "the-negative"],
    past: [13, "the-simple-past"],
    past_neg: [13, "the-simple-past"],
    transitivePast: [14, "generated-paradigms"],
    subj: [12, "the-subjunctive"],
    imperative: [12, "the-imperative"],
    past_prog: [15, "form"],
    perfect: [18, "present-perfect-i-have-come-i-have-done"],
  },
  kmr: {
    present: [10, "building-the-present"],
    present_neg: [10, "building-the-present"],
    past: [13, "the-simple-past"],
    past_neg: [13, "the-simple-past"],
    transitivePast: [14, "the-big-switch"],
    subj: [12, "the-subjunctive"],
    imperative: [12, "the-imperative"],
    past_prog: [15, "form"],
    perfect: [18, "present-perfect"],
  },
};

const NOUN_LESSONS: Record<string, Anchor> = {
  "ckb:def.sg": [7, "the-bare-noun"],
  "ckb:ind.sg": [7, "the-bare-noun"],
  "ckb:def.pl": [7, "the-bare-noun"],
  "ckb:ezafe": [9, "the-linking-vowel"],
  "ckb:ind.ezafe": [9, "indefinite-a-good-man"],
  "ckb:bare+1sg": [11, "on-a-noun"],
  "kmr:def.obl.sg": [9, "oblique-endings"],
  "kmr:def.obl.pl": [9, "oblique-endings"],
  "kmr:def.ez.sg": [8, "the-linking-ending"],
  "kmr:def.ez.pl": [8, "the-linking-ending"],
  "kmr:ind.dir.sg": [7, "a--ek"],
  "kmr:ind.ez.sg": [8, "indefinite-ezafe-a-good-man"],
};

const LESSON_INDEX = lessons as unknown as Record<Course, Record<string, { title: string }>>;

const lessonAt = (lang: Course, [lessonId, anchor]: Anchor): LessonRef => ({
  lang,
  lessonId,
  anchor,
  title: LESSON_INDEX[lang][String(lessonId)]?.title ?? "",
});

/** A small, stable number from a string, to vary drills without storing the choice. */
function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + (char.codePointAt(0) as number)) >>> 0;
  return value;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Every drill there is of one kind for one variety, in the order new ones are introduced. */
export function drillIds(lang: Course, kind: DrillKind): string[] {
  if (kind === "verb") {
    const verbs = referenceVerbs(lang).slice(0, VERBS_DRILLED);
    return VERB_CELLS.flatMap((cell) =>
      verbs.flatMap((verb) =>
        (cell === "imperative" ? IMPERATIVE_PERSONS : PERSONS).map(
          (person) => `verb:${lang}:${verb}:${cell}:${person}`,
        ),
      ),
    );
  }
  if (kind === "noun") {
    const nouns = Object.entries(VOCABULARY[lang]).flatMap(([word, [, note]]) =>
      ["f", "m", "n"].includes(note) ? [word] : [],
    );
    return NOUN_CELLS[lang].flatMap((cell) => nouns.map((noun) => `noun:${lang}:${noun}:${cell}`));
  }
  return allRuleMeta()
    .filter((rule) => rule.lang === lang && !rule.notice)
    .flatMap((rule) => rule.examples.map((_, index) => `spot:${rule.id}:${index}`));
}

function verbDrill(id: string, lang: Course, verb: string, cell: VerbCell, person: string): VerbDrill | null {
  const table = verbTable(lang, verb, [cell], "");
  const index = table.rows.findIndex((row) => row.person === person);
  const row = table.rows[index];
  const form = row?.cells[0];
  if (row === undefined || form === null || form === undefined) return null;
  const ergative = lang === "kmr" && table.ergative;
  let before: string;
  const after = cell === "imperative" ? "!" : ".";
  if (cell === "imperative") before = `(${row.pronoun})`;
  else if (ergative) {
    // The verb agrees with the object, so the agent is anyone else, chosen by the drill's id.
    const others = table.rows.filter((other) => other.person !== person);
    const agent = others[hash(id) % others.length]?.oblique?.split(" / ")[0] ?? "min";
    before = `${capitalize(agent)} ${row.pronoun}`;
  } else before = lang === "kmr" ? capitalize(row.pronoun) : row.pronoun;
  const transitivePast = table.transitive && (cell === "past" || cell === "past_neg");
  return {
    kind: "verb",
    id,
    lang,
    verb,
    meaning: table.meaning,
    cell,
    person,
    before,
    after,
    answer: form.form,
    alternatives: form.solid === undefined ? [] : [form.solid],
    lesson: lessonAt(lang, transitivePast ? VERB_LESSONS[lang].transitivePast : VERB_LESSONS[lang][cell]),
  };
}

function nounDrill(id: string, lang: Course, noun: string, cell: NounCell): NounDrill | null {
  const entry = VOCABULARY[lang][noun];
  const lesson = NOUN_LESSONS[`${lang}:${cell}`];
  if (entry === undefined || lesson === undefined) return null;
  const [meaning, note] = entry;
  const gender = lang === "kmr" && (note === "f" || note === "m") ? note : undefined;
  const form = declension(lang, noun, gender).find((found) => found.cell === cell)?.form;
  if (form === undefined) return null;
  return {
    kind: "noun",
    id,
    lang,
    noun,
    meaning,
    ...(gender !== undefined ? { gender } : {}),
    cell,
    answer: form,
    alternatives: [],
    lesson: lessonAt(lang, lesson),
  };
}

function spotDrill(id: string, rule: string, index: number): SpotDrill | null {
  const meta = allRuleMeta().find((found) => found.id === rule);
  const example = meta?.examples[index];
  const lesson = meta?.lessons[0];
  if (meta === undefined || example === undefined || lesson === undefined || meta.lang === "any") return null;
  const { wrong, right, gloss } = example;
  return {
    kind: "spot",
    id,
    lang: meta.lang,
    rule,
    // The right sentence is not always first, and always in the same place for the same drill.
    choices: hash(id) % 2 === 0 ? [right, wrong] : [wrong, right],
    answer: right,
    ...(gloss !== undefined ? { gloss } : {}),
    lesson,
  };
}

/** The drill an id names, or null when it no longer exists, as when the data changed. */
export function drillFor(id: string): Drill | null {
  const parts = id.split(":");
  const [kind, lang] = parts;
  try {
    if (kind === "verb" && (lang === "ckb" || lang === "kmr") && parts.length === 5) {
      const [, , verb, cell, person] = parts as [string, string, string, string, string];
      if (!(VERB_CELLS as readonly string[]).includes(cell) || !PERSONS.includes(person)) return null;
      return verbDrill(id, lang, verb, cell as VerbCell, person);
    }
    if (kind === "noun" && (lang === "ckb" || lang === "kmr") && parts.length === 4) {
      const [, , noun, cell] = parts as [string, string, string, string];
      if (!(NOUN_CELLS[lang] as readonly string[]).includes(cell)) return null;
      return nounDrill(id, lang, noun, cell as NounCell);
    }
    if (kind === "spot" && parts.length === 3) {
      const [, rule, index] = parts as [string, string, string];
      return /^\d+$/.test(index) ? spotDrill(id, rule, Number(index)) : null;
    }
  } catch {
    // A verb the engine cannot build any more.
  }
  return null;
}

/** An answer as it is compared: normalised, without outer spaces or a final full stop, in lower case. */
function comparable(text: string, lang: Course): string {
  let trimmed = text.trim().replace(/\s+/g, " ");
  // A loop, not a regular expression anchored at the end, which takes quadratic time on "!!!...x".
  while (/[.!?؟]/u.test(trimmed.at(-1) ?? "")) trimmed = trimmed.slice(0, -1);
  return normalize(trimmed, lang).toLowerCase();
}

/** Whether an answer is right. A spot drill is answered with the chosen sentence. */
export function isRight(drill: Drill, given: string): boolean {
  if (drill.kind === "spot") return given === drill.answer;
  const answer = comparable(given, drill.lang);
  return (
    answer !== "" &&
    [drill.answer, ...drill.alternatives].some((form) => comparable(form, drill.lang) === answer)
  );
}
