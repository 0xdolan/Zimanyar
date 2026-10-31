import { ckb, kmr, SimpleLexicon, segmentation, tokenize } from "@zimanyar/core";
import vocabulary from "./vocabulary.json" with { type: "json" };

/**
 * The tables of the lessons, computed by the engine that checks text, as data. These follow zimankit's
 * scripts/gen_tutorials.py, and the fixtures hold them to its output.
 */
export type Course = "ckb" | "kmr";

/** A word's meaning and, for a noun, its gender (f, m) or n. */
export type VocabularyEntry = [meaning: string, note: string];
export const VOCABULARY = vocabulary as unknown as Record<Course, Record<string, VocabularyEntry>>;

export const OTHER_SCRIPT: Record<Course, string> = { ckb: "Latin", kmr: "Arabic script" };
export const SCRIPT_DIR: Record<Course, "rtl" | "ltr"> = { ckb: "rtl", kmr: "ltr" };

const PERSONS: Record<Course, [person: string, pronoun: string][]> = {
  ckb: [
    ["1sg", "من"],
    ["2sg", "تۆ"],
    ["3sg", "ئەو"],
    ["1pl", "ئێمە"],
    ["2pl", "ئێوە"],
    ["3pl", "ئەوان"],
  ],
  kmr: [
    ["1sg", "ez"],
    ["2sg", "tu"],
    ["3sg", "ew"],
    ["1pl", "em"],
    ["2pl", "hûn"],
    ["3pl", "ew"],
  ],
};
const KMR_OBLIQUE: Record<string, string> = {
  "1sg": "min",
  "2sg": "te",
  "3sg": "wî / wê",
  "1pl": "me",
  "2pl": "we",
  "3pl": "wan",
};

type Filter = Record<string, string | null>;
type CellSpec = [title: string, filter: Filter];

const none = null;
const CKB_CELLS: Record<string, CellSpec> = {
  present: ["Present", { tense: "present", mood: "indicative", polarity: none, voice: none, goal: none }],
  present_neg: ["Present negative", { tense: "present", mood: "indicative", polarity: "neg", voice: none }],
  subj: ["Subjunctive", { mood: "subjunctive", polarity: none }],
  subj_neg: ["Subjunctive negative", { mood: "subjunctive", polarity: "neg" }],
  past: ["Simple past", { tense: "past", aspect: "perfective", polarity: none, voice: none, variant: none }],
  past_neg: ["Past negative", { tense: "past", aspect: "perfective", polarity: "neg" }],
  past_prog: ["Past progressive", { tense: "past", aspect: "progressive", polarity: none }],
  past_prog_neg: ["Past progressive negative", { tense: "past", aspect: "progressive", polarity: "neg" }],
  perfect: ["Present perfect", { tense: "present_perfect", voice: none }],
  pluperfect: ["Past perfect", { tense: "past_perfect" }],
  passive_present: ["Passive present", { tense: "present", voice: "passive", polarity: none }],
  passive_present_neg: ["Passive present negative", { tense: "present", voice: "passive", polarity: "neg" }],
  passive_past: ["Passive past", { tense: "past", voice: "passive" }],
  imperative: ["Imperative", { mood: "imperative", polarity: none }],
  prohibitive: ["Prohibitive", { mood: "imperative", polarity: "neg" }],
};
const KMR_CELLS: Record<string, CellSpec> = {
  present: ["Present", { tense: "present", mood: "indicative", polarity: none }],
  present_neg: ["Present negative", { tense: "present", mood: "indicative", polarity: "neg" }],
  subj: ["Subjunctive", { mood: "subjunctive", polarity: none }],
  subj_neg: ["Subjunctive negative", { mood: "subjunctive", polarity: "neg" }],
  past: ["Simple past", { tense: "past", aspect: "perfective", polarity: none }],
  past_neg: ["Past negative", { tense: "past", aspect: "perfective", polarity: "neg" }],
  past_prog: ["Past progressive", { tense: "past", aspect: "progressive", polarity: none }],
  past_prog_neg: ["Past progressive negative", { tense: "past", aspect: "progressive", polarity: "neg" }],
  perfect: ["Present perfect", { tense: "present_perfect" }],
  pluperfect: ["Past perfect", { tense: "past_perfect" }],
  imperative: ["Imperative", { mood: "imperative", polarity: none }],
  prohibitive: ["Prohibitive", { mood: "imperative", polarity: "neg" }],
};
const cellsOf = (lang: Course) => (lang === "ckb" ? CKB_CELLS : KMR_CELLS);

export const CKB_NOUN_CELLS: Record<string, string> = {
  bare: "bare (generic)",
  "def.sg": "the … (sg)",
  "def.pl": "the … (pl)",
  "ind.sg": "a …",
  pl: "… (pl)",
  ezafe: "ezafe (… of / adj)",
  dem: "ئەم / ئەو … ە",
  "ind.ezafe": "a … + adj",
  "def.sg.add": "the … too",
  ...Object.fromEntries(
    ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"].map((p) => [`def.sg+${p}`, `the … + ${p}`]),
  ),
  ...Object.fromEntries(["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"].map((p) => [`bare+${p}`, `… + ${p}`])),
};
export const KMR_NOUN_CELLS: Record<string, string> = {
  "def.dir.sg": "direct sg",
  "def.obl.sg": "oblique sg",
  "def.ez.sg": "ezafe sg",
  "ind.dir.sg": "indef. direct",
  "ind.obl.sg": "indef. oblique",
  "ind.ez.sg": "indef. ezafe",
  "def.dir.pl": "direct pl",
  "def.obl.pl": "oblique pl",
  "def.ez.pl": "ezafe pl",
  "ind.dir.pl": "indef. pl (rare)",
  "voc.sg": "vocative sg",
  "voc.pl": "vocative pl",
};
const nounLabels = (lang: Course) => (lang === "ckb" ? CKB_NOUN_CELLS : KMR_NOUN_CELLS);

export const ipaOf = (lang: Course, word: string): string =>
  lang === "ckb" ? ckb.toIpa(word) : kmr.toIpa(word);
export const otherOf = (lang: Course, word: string): string =>
  lang === "ckb" ? ckb.toLatin(word) : kmr.toArabic(word);
const syllablesOf = (lang: Course, word: string): string[] =>
  lang === "ckb" ? ckb.syllables(word) : kmr.syllables(word);

function meaningOf(lang: Course, word: string): string {
  const entry = VOCABULARY[lang][word];
  if (entry === undefined) throw new Error(`${lang}: ${word} is not in the vocabulary`);
  return entry[0];
}

function genderOf(lang: Course, word: string): "f" | "m" {
  const note = VOCABULARY[lang][word]?.[1];
  if (note !== "f" && note !== "m") throw new Error(`${lang}: ${word} has no gender in the vocabulary`);
  return note;
}

type AnyVerb = ckb.Verb | kmr.Verb;
type AnyForm = ckb.VerbForm | kmr.VerbForm;
const verbMemo = new Map<Course, Map<string, AnyVerb>>();

function coreVerbs(lang: Course): Map<string, AnyVerb> {
  let known = verbMemo.get(lang);
  if (known === undefined) {
    const list: AnyVerb[] = lang === "ckb" ? ckb.loadCoreVerbs() : kmr.loadCoreVerbs();
    known = new Map(list.map((verb) => [verb.infinitive, verb]));
    verbMemo.set(lang, known);
  }
  return known;
}

export function verbOf(lang: Course, infinitive: string): AnyVerb {
  const known = coreVerbs(lang);
  const found = known.get(infinitive);
  if (found !== undefined) return found;
  const simple = new Map([...known].filter(([, verb]) => !verb.preverb));
  const made =
    lang === "ckb"
      ? ckb.makeVerb(infinitive, null, null, "tutorial", simple as Map<string, ckb.Verb>)
      : kmr.makeVerb(infinitive, null, null, "tutorial", simple as Map<string, kmr.Verb>);
  if (made === null) throw new Error(`${lang}: cannot build the verb ${infinitive}`);
  return made;
}

const conjugated = (lang: Course, verb: AnyVerb): AnyForm[] =>
  lang === "ckb" ? ckb.conjugate(verb as ckb.Verb) : kmr.conjugate(verb as kmr.Verb);

/** Several forms can fill one cell. Teach the standard one: in Sorani the agent clitic follows the preverb. */
function preferred(lang: Course, verb: AnyVerb, forms: string[]): string {
  if (lang === "ckb" && verb.preverb && !(verb as ckb.Verb).light && forms.length > 1) {
    for (const form of forms) {
      if (!form.slice(verb.preverb.length).startsWith(verb.past)) return form;
    }
  }
  return forms[0] as string;
}

/** Person to form, for one cell of a paradigm. Kurmanji's one plural form fills all three plural persons. */
export function verbCell(lang: Course, verb: AnyVerb, cell: string): Record<string, string> {
  const spec = cellsOf(lang)[cell];
  if (spec === undefined) throw new Error(`${lang}: unknown verb cell ${cell}`);
  const candidates = new Map<string, string[]>();
  for (const { form, features } of conjugated(lang, verb)) {
    if (!Object.entries(spec[1]).every(([key, value]) => (features[key] ?? null) === value)) continue;
    const person = features["person"] ?? features["agent"];
    if (!person || person === "external") continue;
    for (const one of person === "pl" ? ["1pl", "2pl", "3pl"] : person.split("|")) {
      candidates.set(one, [...(candidates.get(one) ?? []), form]);
    }
  }
  return Object.fromEntries([...candidates].map(([person, forms]) => [person, preferred(lang, verb, forms)]));
}

/** A form with what is shown beneath it. Null when the form does not exist. */
export type FormCell = { form: string; other?: string; ipa?: string } | null;

function formCell(lang: Course, form: string | null | undefined, show: string): FormCell {
  if (!form) return null;
  return {
    form,
    ...(show.includes("translit") ? { other: otherOf(lang, form) } : {}),
    ...(show.includes("ipa") ? { ipa: ipaOf(lang, form) } : {}),
  };
}

export interface VerbTableData {
  infinitive: string;
  other: string;
  meaning: string;
  present: string;
  past: string;
  transitive: boolean;
  preverb: string;
  columns: string[];
  /** Kurmanji's ergative tenses have columns for the agent and the object. */
  ergative: boolean;
  rows: { person: string; pronoun: string; oblique?: string; cells: FormCell[] }[];
}

const ERGATIVE_CELLS = new Set(["past", "past_neg", "past_prog", "past_prog_neg", "perfect", "pluperfect"]);

export function verbTable(
  lang: Course,
  infinitive: string,
  cells: readonly string[],
  show = "translit",
): VerbTableData {
  const verb = verbOf(lang, infinitive);
  const data = cells.map((cell) => verbCell(lang, verb, cell));
  let persons = PERSONS[lang].filter(([person]) => data.some((cell) => person in cell));
  if (cells.every((cell) => cell === "imperative" || cell === "prohibitive")) {
    persons = persons.filter(([person]) => person === "2sg" || person === "2pl");
  }
  const ergative = verb.transitive && cells.some((cell) => ERGATIVE_CELLS.has(cell));
  return {
    infinitive,
    other: otherOf(lang, infinitive),
    meaning: meaningOf(lang, infinitive),
    present: verb.present,
    past: verb.past,
    transitive: verb.transitive,
    preverb: verb.preverb,
    columns: cells.map((cell) => (cellsOf(lang)[cell] as CellSpec)[0]),
    ergative,
    rows: persons.map(([person, pronoun]) => ({
      person,
      pronoun,
      ...(lang === "kmr" && ergative ? { oblique: KMR_OBLIQUE[person] as string } : {}),
      cells: data.map((cell) => formCell(lang, cell[person], show)),
    })),
  };
}

/** The sections of a verb's own page, leaving out those it has no forms for. */
export function verbSections(lang: Course, infinitive: string): { title: string; cells: string[] }[] {
  const verb = verbOf(lang, infinitive);
  const groups: [string, string[]][] = [
    ["Present-stem forms", ["present", "present_neg"]],
    ["Subjunctive", ["subj", "subj_neg"]],
    ["Simple past", ["past", "past_neg"]],
    ["Past progressive", ["past_prog", "past_prog_neg"]],
    ["Perfect tenses", ["perfect", "pluperfect"]],
    ...(lang === "ckb" && verb.transitive
      ? ([["Passive", ["passive_present", "passive_present_neg", "passive_past"]]] as [string, string[]][])
      : []),
    ["Imperative", ["imperative", "prohibitive"]],
  ];
  return groups.flatMap(([title, cells]) => {
    const present = cells.filter((cell) => Object.keys(verbCell(lang, verb, cell)).length > 0);
    return present.length > 0 ? [{ title, cells: present }] : [];
  });
}

/** A verb's forms that have no person: the infinitive, participles and the like. */
export function verbOtherForms(lang: Course, infinitive: string): [label: string, form: string][] {
  const found = new Map<string, string>();
  const keep = (key: string, form: string) => {
    if (!found.has(key)) found.set(key, form);
  };
  for (const { form, features } of conjugated(lang, verbOf(lang, infinitive))) {
    const name = features["form"];
    if (name !== undefined) keep(name.replaceAll("_", " "), form);
    else if (features["agent"] === "external" && !features["polarity"]) {
      const tense = (features["tense"] ?? "").replaceAll("_", " ");
      keep(`${`${tense} ${features["aspect"] ?? ""}`.trim()}, agent clitic elsewhere`, form);
    }
  }
  return [...found];
}

const nounForms = (lang: Course, noun: string): Map<string, string | null> =>
  new Map(lang === "ckb" ? ckb.decline(noun) : kmr.decline(noun, genderOf(lang, noun)));

export interface NounTableData {
  columns: string[];
  gender: boolean;
  rows: { noun: string; meaning: string; gender?: string; cells: FormCell[] }[];
}

export function nounTable(
  lang: Course,
  nouns: readonly string[],
  cells?: readonly string[],
  show = "translit",
): NounTableData {
  const labels = nounLabels(lang);
  const chosen = cells ?? Object.keys(labels);
  for (const cell of chosen) {
    if (labels[cell] === undefined) throw new Error(`${lang}: unknown noun cell ${cell}`);
  }
  return {
    columns: chosen.map((cell) => labels[cell] as string),
    gender: lang === "kmr",
    rows: nouns.map((noun) => {
      const forms = nounForms(lang, noun);
      return {
        noun,
        meaning: meaningOf(lang, noun),
        ...(lang === "kmr" ? { gender: genderOf(lang, noun) } : {}),
        cells: chosen.map((cell) => formCell(lang, forms.get(cell), show)),
      };
    }),
  };
}

/** One Sorani noun with each personal clitic, bare and definite. */
export function nounPersons(lang: Course, noun: string) {
  const forms = nounForms(lang, noun);
  return {
    noun,
    meaning: meaningOf(lang, noun),
    rows: PERSONS[lang].map(([person, pronoun]) => ({
      person,
      pronoun,
      bare: formCell(lang, forms.get(`bare+${person}`), "translit"),
      definite: formCell(lang, forms.get(`def.sg+${person}`), "translit"),
    })),
  };
}

/** Every form of a noun that exists, for the reference page. */
export function nounReference(lang: Course, noun: string): { label: string; form: string; other: string }[] {
  const labels = nounLabels(lang);
  return [...nounForms(lang, noun)].flatMap(([cell, form]) =>
    form ? [{ label: labels[cell] as string, form, other: otherOf(lang, form) }] : [],
  );
}

export const nounsOf = (lang: Course): string[] =>
  Object.entries(VOCABULARY[lang]).flatMap(([word, [, note]]) =>
    ["f", "m", "n"].includes(note) ? [word] : [],
  );

export const wordRows = (lang: Course, words: readonly string[]) =>
  words.map((word) => ({
    word,
    other: otherOf(lang, word),
    ipa: ipaOf(lang, word),
    syllables: syllablesOf(lang, word).join("."),
    meaning: meaningOf(lang, word),
  }));

function joinTokens(tokens: readonly string[]): string {
  return tokens
    .join(" ")
    .replace(/([«(]) /g, "$1")
    .replace(/ ([.,;:!?،؛؟»)])/g, "$1");
}

const TO_ARABIC_MARKS: Record<string, string> = { "?": "؟", ",": "،", ";": "؛" };
const TO_LATIN_MARKS: Record<string, string> = { "؟": "?", "،": ",", "؛": ";" };

/** A sentence in the other script, with its punctuation changed to match. */
export function textOther(lang: Course, text: string): string {
  const marks = lang === "kmr" ? TO_ARABIC_MARKS : TO_LATIN_MARKS;
  return joinTokens(
    tokenize(text).map((token) =>
      token.kind === "word"
        ? otherOf(lang, token.text)
        : Array.from(token.text, (char) => marks[char] ?? char).join(""),
    ),
  );
}

export const textIpa = (lang: Course, text: string): string =>
  `/${tokenize(text)
    .flatMap((token) => (token.kind === "word" ? [ipaOf(lang, token.text)] : []))
    .join(" ")}/`;

const lessonLexicon = (lang: Course): SimpleLexicon => {
  const lexicon = new SimpleLexicon();
  for (const [word, [, note]] of Object.entries(VOCABULARY[lang])) {
    lexicon.add(
      word,
      ["f", "m", "n"].includes(note) ? "NOUN" : null,
      note === "f" || note === "m" ? note : null,
    );
  }
  return lexicon;
};

const analyzers = new Map<Course, ckb.CkbAnalyzer | kmr.KmrAnalyzer>();

/** How the analyzer reads each word, knowing only the words of the lessons. */
export function analyzeRows(lang: Course, words: readonly string[]) {
  let analyzer = analyzers.get(lang);
  if (analyzer === undefined) {
    analyzer =
      lang === "ckb" ? new ckb.CkbAnalyzer(lessonLexicon(lang)) : new kmr.KmrAnalyzer(lessonLexicon(lang));
    analyzers.set(lang, analyzer);
  }
  const reader = analyzer;
  return words.map((word) => {
    const reading = reader.best(word);
    if (reading === null) throw new Error(`${lang}: no analysis for ${word}`);
    return {
      word,
      segmentation: segmentation(reading),
      gloss: reading.segments.length > 0 ? reading.segments.map(([, tag]) => tag).join("+") : "STEM",
      lemma: reading.lemma,
      features: Object.entries(reading.features)
        .filter(([key]) => key !== "past_stem" && key !== "present_stem")
        .map(([key, value]) => `${key}=${value}`)
        .join(", "),
    };
  });
}

/** Who does what in a Kurmanji sentence, and whether the verb agrees. */
export function ergativityRows(sentences: readonly (readonly [string, string])[]) {
  return sentences.map(([sentence, english]) => {
    const record = kmr.detectAlignment(sentence);
    const show = (argument: { token: string; case: string } | null) =>
      argument ? `${argument.token} (${argument.case})` : null;
    return {
      sentence,
      english,
      alignment: record.alignment,
      agent: show(record.agent),
      object: show(record.object),
      controller: record.controller,
      verbPerson: record.verbPerson ?? "?",
      agrees: record.agreementOk === true,
      notes: record.notes,
    };
  });
}

/** Typed text, the same after normalising, and what the validator still finds wrong in each word. */
export function normalizeRows(lang: Course, lines: readonly (readonly [string, string])[]) {
  const normalize = lang === "ckb" ? ckb.normalize : kmr.normalize;
  const validate = lang === "ckb" ? ckb.validateWord : kmr.validateWord;
  return lines.map(([raw, note]) => {
    const fixed = normalize(raw);
    const problems = new Set<string>();
    for (const token of tokenize(fixed)) {
      if (token.kind !== "word") continue;
      const found = validate(token.text);
      if (found.length > 0) problems.add(`${token.text}: ${found.join("; ")}`);
    }
    // Python's sorted order, by code point rather than by UTF-16 unit or locale.
    return { raw, fixed, problems: [...problems].sort(), note };
  });
}

const CKB_NON_JOINING = new Set("ادرڕزژوۆە");
const ZWJ = "‍";

const CKB_ALPHABET: readonly (readonly [string, string | null, string, string])[] = [
  ["ئ", null, "ʔ", "ئاو"],
  ["ا", "a", "aː", "باران"],
  ["ب", "b", "b", "باوک"],
  ["پ", "p", "p", "پیاو"],
  ["ت", "t", "t", "تۆ"],
  ["ج", "c", "dʒ", "جوان"],
  ["چ", "ç", "tʃ", "چاو"],
  ["ح", "ḧ", "ħ", "حەوت"],
  ["خ", "x", "x", "خەو"],
  ["د", "d", "d", "دار"],
  ["ر", "r", "ɾ", "بەرد"],
  ["ڕ", "rr", "r", "ڕۆژ"],
  ["ز", "z", "z", "زمان"],
  ["ژ", "j", "ʒ", "ژن"],
  ["س", "s", "s", "سەر"],
  ["ش", "ş", "ʃ", "شار"],
  ["ع", "'", "ʕ", "عەقڵ"],
  ["غ", "ẍ", "ɣ", "غەریب"],
  ["ف", "f", "f", "فڕین"],
  ["ڤ", "v", "v", "ڤیدیۆ"],
  ["ق", "q", "q", "قەڵەم"],
  ["ک", "k", "k", "کتێب"],
  ["گ", "g", "ɡ", "گوڵ"],
  ["ل", "l", "l", "لاو"],
  ["ڵ", "ll", "ɫ", "ماڵ"],
  ["م", "m", "m", "مانگ"],
  ["ن", "n", "n", "نان"],
  ["ه", "h", "h", "هەوا"],
  ["ە", "e", "æ", "ئەسپ"],
  ["و", "w / u", "w, u", "وڵات"],
  ["وو", "û", "uː", "بوون"],
  ["ۆ", "o", "oː", "ڕۆژ"],
  ["ی", "y / î", "j, iː", "شیر"],
  ["ێ", "ê", "eː", "سێو"],
];
const KMR_ALPHABET: readonly (readonly [string, string, string, string])[] = [
  ["a", "ا", "aː", "av"],
  ["b", "ب", "b", "bav"],
  ["c", "ج", "dʒ", "ciwan"],
  ["ç", "چ", "tʃ", "çav"],
  ["d", "د", "d", "dar"],
  ["e", "ە", "ɛ", "dest"],
  ["ê", "ێ", "eː", "êvar"],
  ["f", "ف", "f", "firîn"],
  ["g", "گ", "ɡ", "gul"],
  ["h", "ه", "h", "hesp"],
  ["i", "(unwritten)", "ɪ", "jin"],
  ["î", "ی", "iː", "şîr"],
  ["j", "ژ", "ʒ", "jin"],
  ["k", "ک", "k", "kitêb"],
  ["l", "ل", "l", "ling"],
  ["m", "م", "m", "mal"],
  ["n", "ن", "n", "nan"],
  ["o", "ۆ", "oː", "roj"],
  ["p", "پ", "p", "pirtûk"],
  ["q", "ق", "q", "qelem"],
  ["r", "ر / ڕ", "ɾ, r", "bira"],
  ["s", "س", "s", "sêv"],
  ["ş", "ش", "ʃ", "şev"],
  ["t", "ت", "t", "tu"],
  ["u", "و", "ʊ", "kurd"],
  ["û", "وو", "uː", "çûn"],
  ["v", "ڤ", "v", "av"],
  ["w", "و", "w", "welat"],
  ["x", "خ", "x", "xew"],
  ["y", "ی", "j", "yek"],
  ["z", "ز", "z", "ziman"],
];

export const ckbAlphabet = () =>
  CKB_ALPHABET.map(([letter, latin, ipa, example]) => {
    const joins = !CKB_NON_JOINING.has(letter.at(-1) as string);
    return {
      letter,
      initial: joins ? letter + ZWJ : letter,
      medial: joins ? ZWJ + letter + ZWJ : ZWJ + letter,
      final: ZWJ + letter,
      latin,
      ipa,
      joins,
      example,
      other: otherOf("ckb", example),
      meaning: meaningOf("ckb", example),
    };
  });

export const kmrAlphabet = () =>
  KMR_ALPHABET.map(([letter, arabic, ipa, example]) => ({
    upper: letter.toUpperCase(),
    letter,
    arabic,
    ipa,
    example,
    other: otherOf("kmr", example),
    meaning: meaningOf("kmr", example),
  }));

const EXTRA_VERBS: Record<Course, string[]> = {
  ckb: ["هەڵگرتن", "ڕاگەیاندن", "دەستپێکردن", "کردنەوە", "گەڕانەوە"],
  kmr: ["rabûn", "hilgirtin", "vekirin", "derketin", "rûniştin"],
};

/** Every verb with its own page. */
export const referenceVerbs = (lang: Course): string[] => [
  ...new Set([...coreVerbs(lang).keys(), ...EXTRA_VERBS[lang]]),
];

const SLUG_LETTERS: Record<string, string> = {
  ç: "c",
  ê: "e",
  î: "i",
  ş: "s",
  û: "u",
  é: "e",
  á: "a",
  í: "i",
  ú: "u",
};

const plainSlug = (lang: Course, infinitive: string): string =>
  Array.from(lang === "ckb" ? otherOf(lang, infinitive) : infinitive, (char) => {
    const lowered = char.toLowerCase();
    return SLUG_LETTERS[lowered] ?? lowered;
  })
    .join("")
    .split(/[^a-z0-9]+/)
    .filter((part) => part !== "")
    .join("-");

const slugMemo = new Map<Course, Map<string, string>>();

/**
 * The name of a verb's page, the same as zimankit's, except that a verb whose name another has already
 * taken gets a number: kirîn (to buy) would otherwise overwrite the page of kirin (to do).
 */
export function verbSlug(lang: Course, infinitive: string): string {
  let slugs = slugMemo.get(lang);
  if (slugs === undefined) {
    slugs = new Map();
    const taken = new Map<string, number>();
    for (const verb of referenceVerbs(lang)) {
      const plain = plainSlug(lang, verb);
      const count = (taken.get(plain) ?? 0) + 1;
      taken.set(plain, count);
      slugs.set(verb, count === 1 ? plain : `${plain}-${count}`);
    }
    slugMemo.set(lang, slugs);
  }
  return slugs.get(infinitive) ?? plainSlug(lang, infinitive);
}

export const verbIndexRows = (lang: Course) =>
  referenceVerbs(lang).map((infinitive) => {
    const verb = verbOf(lang, infinitive);
    return {
      infinitive,
      slug: verbSlug(lang, infinitive),
      other: otherOf(lang, infinitive),
      meaning: meaningOf(lang, infinitive),
      transitive: verb.transitive,
      present: verbCell(lang, verb, "present")["1sg"] ?? null,
      past: verbCell(lang, verb, "past")["3sg"] ?? null,
    };
  });

/** Python sorts words by lower case, by code point. */
const byCodePoint = (a: string, b: string): number => {
  const [left, right] = [Array.from(a), Array.from(b)];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = (left[i]?.codePointAt(0) as number) - (right[i]?.codePointAt(0) as number);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
};

export const vocabularyRows = (lang: Course) =>
  Object.keys(VOCABULARY[lang])
    .sort((a, b) => byCodePoint(a.toLowerCase(), b.toLowerCase()))
    .map((word) => {
      const [meaning, note] = VOCABULARY[lang][word] as VocabularyEntry;
      return { word, other: otherOf(lang, word), ipa: ipaOf(lang, word), meaning, note };
    });
