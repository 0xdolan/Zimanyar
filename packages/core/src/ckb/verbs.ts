import {
  CKB_CLITIC_SUBJECT_PRESENT,
  CKB_HIDDEN_FORMS,
  CKB_IRREGULAR,
  CKB_IRREGULAR_VARIANTS,
  CKB_NO_PASSIVE,
  CKB_PASSIVE_STEM,
  CKB_PAST_SUBJUNCTIVES,
  CKB_PERFECT_LONG,
  CKB_PERFECT_SHORT,
  CKB_PREVERBS,
  CKB_SET2,
  CKB_SPLIT_PREVERBS,
  CKB_VERBS_CORE_TSV,
  CKB_VOWEL_END,
} from "../generated/tables.js";

export const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] as const;
type Person = (typeof PERSONS)[number];
type Features = Record<string, string>;

const EWE = "ەوە"; // ەوە
const NUN = "ن"; // ن
const DE = "دە"; // دە
const NA = "نا"; // نا
const NE = "نە"; // نە
const ME = "مە"; // مە
const BE = "ب"; // ب
const AE = "ە"; // ە
const ALEF = "ا"; // ا
const YEH = "ی"; // ی
const LONG_E = "ێ"; // ێ
const BUU = "بوو"; // بوو
const WW = "وو"; // وو
const SOLID_VOWELS = "اەۆێ"; // ا ە ۆ ێ

const irregulars = CKB_IRREGULAR as Record<string, Record<string, string>>;
const clitics = CKB_SET2 as Record<Person, string>;
const passiveStems = CKB_PASSIVE_STEM as Record<string, string>;
const cliticPresents = CKB_CLITIC_SUBJECT_PRESENT as Record<string, string>;
const irregularVariants = CKB_IRREGULAR_VARIANTS as Record<string, Record<string, string>>;
const hiddenForms = CKB_HIDDEN_FORMS as Record<string, string[]>;
const perfectLong = CKB_PERFECT_LONG as Record<Person, string>;
const perfectShort = CKB_PERFECT_SHORT as Record<Person, string>;
const pastSubjunctives = CKB_PAST_SUBJUNCTIVES as [mark: string, tense: string][];
const noPassive = new Set<string>(CKB_NO_PASSIVE);
const preverbs: readonly string[] = CKB_PREVERBS;
const splitPreverbs = new Set<string>(CKB_SPLIT_PREVERBS);
/** Compound parts that are too short to tell apart from another word: پاڵاوتن is not پاڵا + وتن. */
const ONLY_AFTER_PREVERB = new Set(["وتن", "گوتن", "زان"]);

export interface Verb {
  infinitive: string;
  past: string;
  present: string;
  transitive: boolean;
  preverb: string;
  /** ەوە for verbs like کردنەوە. */
  suffix: string;
  source: string;
  /** A noun or adjective with a light verb, which keeps the subjunctive ب. */
  light: boolean;
}

export interface VerbForm {
  form: string;
  lemma: string;
  features: Features;
}

/** Is the first part written apart even with no clitic? Noun + light verb and some preverbs are. */
const alwaysSplit = (verb: Verb): boolean =>
  verb.preverb !== "" && (verb.light || splitPreverbs.has(verb.preverb) || !preverbs.includes(verb.preverb));

export function baseInfinitive(verb: Verb): string {
  let infinitive = verb.infinitive;
  if (verb.suffix && infinitive.endsWith(verb.suffix)) infinitive = infinitive.slice(0, -verb.suffix.length);
  if (verb.preverb && infinitive.startsWith(verb.preverb)) infinitive = infinitive.slice(verb.preverb.length);
  return infinitive;
}

export function loadCoreVerbs(): Verb[] {
  const verbs: Verb[] = [];
  for (const line of CKB_VERBS_CORE_TSV.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [infinitive = "", past = "", present = "", transitive = "", preverb = ""] = line
      .split("\t")
      .map((column) => column.trim());
    verbs.push({
      infinitive,
      past,
      present,
      transitive: transitive === "T",
      preverb,
      suffix: infinitive.endsWith(EWE) ? EWE : "",
      source: "core",
      light: false,
    });
  }
  return verbs;
}

/** The past stem is the infinitive without its final ن. */
export function pastStemOf(infinitive: string): string | null {
  const base = infinitive.endsWith(EWE) ? infinitive.slice(0, -3) : infinitive;
  if (base.length >= 3 && base.endsWith(NUN) && "دتیاو".includes(base.at(-2) as string)) {
    return base.slice(0, -1);
  }
  return null;
}

/** A rule of thumb for verbs missing from the reference list. */
export function guessPresentStem(past: string, transitive: boolean | null = null): string {
  if (past.endsWith(WW)) return past; // دروو, سوو, جوو; چوون and بوون are in the list
  if (past.endsWith(ALEF) && transitive === false) return `${past.slice(0, -1)}${LONG_E}`; // دڕا -> دڕێ
  if (past.endsWith("اند")) return `${past.slice(0, -3)}ێن`;
  if (past.endsWith("ارد")) return `${past.slice(0, -3)}ێر`;
  if (past.endsWith(ALEF) || past.endsWith(YEH)) return past.slice(0, -1);
  if (past.endsWith("شت") || past.endsWith("ست")) return past.slice(0, -1);
  if (past.endsWith("ت") || past.endsWith("د")) return past.slice(0, -1);
  return past;
}

/** Build a verb from any infinitive, taking apart preverbs, ەوە and compounds. */
export function makeVerb(
  infinitive: string,
  transitive: boolean | null = null,
  present: string | null = null,
  source = "guess",
  known: ReadonlyMap<string, Verb> = new Map(),
): Verb | null {
  const existing = known.get(infinitive);
  if (existing) return existing;
  const suffix = infinitive.endsWith(NUN + EWE) ? EWE : "";
  const core = suffix ? infinitive.slice(0, -3) : infinitive;
  const build = (base: Verb, preverb: string, light = false, tr = transitive ?? base.transitive): Verb => ({
    infinitive,
    past: base.past,
    present: base.present,
    transitive: tr,
    preverb,
    suffix,
    source,
    light,
  });
  for (const preverb of preverbs) {
    const base = known.get(core.slice(preverb.length));
    if (core.startsWith(preverb) && base) return build(base, preverb);
  }
  const whole = known.get(core);
  if (suffix && whole) return build(whole, "", false, whole.transitive);
  // A compound written solid: a non-verbal element and a known verb.
  for (let k = 2; k < core.length - 2; k++) {
    const base = known.get(core.slice(k));
    if (base && !base.preverb) {
      const preverb = core.slice(0, k);
      if (ONLY_AFTER_PREVERB.has(core.slice(k)) && !preverbs.includes(preverb)) continue;
      return build(base, preverb, !preverbs.includes(preverb));
    }
  }
  const past = pastStemOf(core);
  if (!past) return null;
  return {
    infinitive,
    past,
    present: present || guessPresentStem(past, transitive),
    transitive: transitive ?? true,
    preverb: "",
    suffix,
    source,
    light: false,
  };
}

/** Phonologically vowel-final: a final و or ی after a vowel letter is a glide. */
function vowelFinal(stem: string): boolean {
  if (stem === "") return false;
  const last = stem.at(-1) as string;
  if (SOLID_VOWELS.includes(last)) return true;
  if (last === "و" || last === YEH) {
    const before = stem.at(-2);
    return before === undefined || before === last || !SOLID_VOWELS.includes(before);
  }
  return false;
}

const SET1_AFTER_VOWEL: Record<Exclude<Person, "3sg">, string> = {
  "1sg": "م",
  "2sg": "یت",
  "1pl": "ین",
  "2pl": NUN,
  "3pl": NUN,
};

function set1Present(stem: string, person: Person): string {
  if (vowelFinal(stem)) {
    if (person === "3sg") {
      const last = stem.at(-1);
      if (last === AE) return `${stem.slice(0, -1)}ات`;
      if (last === "ۆ") return `${stem.slice(0, -1)}وات`;
      if (last === YEH) return stem;
      return `${stem}ت`;
    }
    return stem + SET1_AFTER_VOWEL[person];
  }
  return stem + (person === "3sg" ? "ێت" : SET1_AFTER_VOWEL[person]);
}

function set1Past(stem: string, person: Person): string {
  return stem + (person === "3sg" ? "" : SET1_AFTER_VOWEL[person]);
}

function passiveStem(verb: Verb): string {
  const known = passiveStems[baseInfinitive(verb)];
  if (known !== undefined) return known;
  const present = verb.present;
  if (present.endsWith("ر") || present.endsWith("ڕ")) return `${present}در`;
  if (present.endsWith("ۆ")) return `${present.slice(0, -1)}ور`;
  if (present.endsWith(AE) || present.endsWith(LONG_E) || present.endsWith(YEH)) {
    return `${present.slice(0, -1)}ر`;
  }
  return `${present}ر`;
}

function perfectBase(past: string): string {
  if (past.endsWith(WW)) return past;
  return past + (CKB_VOWEL_END.includes(past.at(-1) as string) ? "و" : WW);
}

function withSuffix(form: string, suffix: string): string {
  if (!suffix) return form;
  if (form.endsWith(AE)) return `${form}وە`;
  if (form.endsWith(ALEF)) return `${form}یەوە`;
  if (form.endsWith(YEH) || form.endsWith("و")) return `${form}ەوە`; // never three و
  if (form !== "" && CKB_VOWEL_END.includes(form.at(-1) as string)) return `${form}وە`;
  return form + suffix;
}

const PERFECT_CLITICS: Record<Person, string> = {
  "1sg": "مە",
  "2sg": "تە",
  "3sg": "یەتی",
  "1pl": "مانە",
  "2pl": "تانە",
  "3pl": "یانە",
};
/** Every single-word form of a verb, with its features, in zimankit's order. */
export function conjugate(verb: Verb): VerbForm[] {
  const { preverb: pre, suffix: suf, infinitive: lemma, present: pres, past, transitive, light } = verb;
  const base = baseInfinitive(verb);
  const irregular = irregulars[base] ?? {};
  const cell = (name: string, person: string, regular: string) => irregular[`${name}|${person}`] ?? regular;
  const forms: VerbForm[] = [];
  const cliticPresent = cliticPresents[base];
  const push = (form: string, features: Features) => {
    forms.push({ form, lemma, features: { pos: "VERB", ...features } });
  };
  const emit = (surface: string, features: Features): void => {
    if (suf && features["tense"] === "present_perfect") {
      // خوێندووەتەوە, چووینەتەوە
      push(`${pre}${surface}تەوە`, features);
      // هاتۆتەوە, recognised but not shown
      if (surface.endsWith("ووە"))
        push(`${pre}${surface.slice(0, -3)}ۆتەوە`, { ...features, variant: "contracted" });
      // گەڕاونەوە: common without the ت, recognised but not shown
      if (!surface.endsWith("وە")) push(withSuffix(pre + surface, suf), { ...features, variant: "no_t" });
      return;
    }
    if (suf && past.endsWith(YEH) && surface.endsWith(past)) {
      // دۆزی + ی + ەوە; دۆزیەوە is common, recognised but not shown
      push(withSuffix(pre + surface + YEH, suf), features);
      push(withSuffix(pre + surface, suf), { ...features, variant: "one_ye" });
    } else {
      push(withSuffix(pre + surface, suf), features);
    }
    // Speech and poetry drop the ت: دەکا, دەڵێ, دەمەوێ, دەکەی
    if (features["tense"] === "present" && !("variant" in features) && !("goal" in features)) {
      const person = features["person"];
      if (
        surface.endsWith("ت") &&
        (person === "3sg" || cliticPresent || (person === "2sg" && surface.endsWith("یت")))
      ) {
        emit(surface.slice(0, -1), { variant: "short", ...features });
      }
    }
  };
  // On a guessed verb a vowel-final stem + با/بێت is more often another word: کوبا, ڕازی بێت
  const subjunctives =
    verb.source === "core" || !CKB_VOWEL_END.includes(past.at(-1) ?? "\0") ? pastSubjunctives : [];
  // The clitic belongs directly on the first part in every tense: هەڵم+نەگرت, هەڵم+دەگرت, هەڵم+گرتووە.
  const late: Features = pre ? { variant: "clitic_late" } : {};
  /** ب follows a preverb (هەڵبگرم) and may be dropped (هەڵگرم): the bare form is a variant. */
  const noB = (surface: string, features: Features) => {
    if (pre && !light) emit(surface, { variant: "no_b", ...features });
  };

  for (const p of PERSONS) {
    if (cliticPresent) {
      const clitic = clitics[p] + cliticPresent;
      emit(DE + clitic, { tense: "present", mood: "indicative", person: p });
      emit(NA + clitic, { tense: "present", mood: "indicative", person: p, polarity: "neg" });
      emit(BE + clitic, { tense: "present", mood: "subjunctive", person: p });
      emit(NE + clitic, { tense: "present", mood: "subjunctive", person: p, polarity: "neg" });
    } else {
      const stem = set1Present(pres, p);
      emit(cell("present", p, DE + stem), { tense: "present", mood: "indicative", person: p });
      emit(cell("present_neg", p, NA + stem), {
        tense: "present",
        mood: "indicative",
        person: p,
        polarity: "neg",
      });
      emit(cell("subjunctive", p, BE + stem), { tense: "present", mood: "subjunctive", person: p });
      if (irregular[`subjunctive|${p}`] === undefined) {
        noB(stem, { tense: "present", mood: "subjunctive", person: p });
      }
      emit(cell("subjunctive_neg", p, NE + stem), {
        tense: "present",
        mood: "subjunctive",
        person: p,
        polarity: "neg",
      });
    }
    if (transitive) {
      const clitic = clitics[p];
      const ergative = { agent: p, alignment: "ergative" };
      const negative = { ...ergative, polarity: "neg" };
      emit(past + clitic, { tense: "past", aspect: "perfective", ...ergative, ...late });
      emit(NE + clitic + past, { tense: "past", aspect: "perfective", ...negative, ...late });
      emit(DE + clitic + past, { tense: "past", aspect: "progressive", ...ergative, ...late });
      emit(NE + clitic + DE + past, { tense: "past", aspect: "progressive", ...negative, ...late });
      const perfect = perfectBase(past);
      // کردوویەتەوە
      const perfectClitic = suf && p === "3sg" ? "یە" : PERFECT_CLITICS[p];
      emit(perfect + perfectClitic, { tense: "present_perfect", ...ergative, ...late });
      // هێناویە
      if (p === "3sg" && !suf)
        emit(`${perfect}یە`, { tense: "present_perfect", ...ergative, variant: "short" });
      emit(NE + clitic + perfect + AE, { tense: "present_perfect", ...negative, ...late });
      emit(past + BUU + clitic, { tense: "past_perfect", ...ergative, ...late });
      emit(NE + clitic + past + BUU, { tense: "past_perfect", ...negative, ...late });
      for (const [mark, tense] of subjunctives) {
        const subjunctive = { tense, mood: "subjunctive", ...ergative };
        emit(past + mark + clitic, { ...subjunctive, ...late });
        emit(NE + clitic + past + mark, { ...subjunctive, polarity: "neg", ...late });
        emit(NE + past + mark + clitic, { ...subjunctive, polarity: "neg", variant: "clitic_end" });
      }
      const stem = passiveStem(verb);
      // گرترا, بردرا: recognised, not shown
      if ((past.endsWith("ت") || past.endsWith("د")) && !noPassive.has(lemma) && !cliticPresent) {
        emit(set1Past(`${past}را`, p), { tense: "past", voice: "passive", person: p, variant: "past_stem" });
      }
      // A lone ر is a guessed stem.
      if ((!cliticPresent || passiveStems[base] !== undefined) && !noPassive.has(lemma) && stem.length >= 2) {
        const passive = { voice: "passive", person: p };
        const ending = set1Present(LONG_E, p);
        emit(DE + stem + ending, { tense: "present", ...passive });
        emit(NA + stem + ending, { tense: "present", ...passive, polarity: "neg" });
        emit(BE + stem + ending, { tense: "present", mood: "subjunctive", ...passive });
        emit(NE + stem + ending, { tense: "present", mood: "subjunctive", ...passive, polarity: "neg" });
        const passivePast = stem + ALEF;
        emit(set1Past(passivePast, p), { tense: "past", ...passive });
        emit(NE + set1Past(passivePast, p), { tense: "past", polarity: "neg", ...passive });
        emit(DE + set1Past(passivePast, p), { tense: "past", aspect: "progressive", ...passive });
        emit(NE + DE + set1Past(passivePast, p), {
          tense: "past",
          aspect: "progressive",
          polarity: "neg",
          ...passive,
        });
        // The sources print the short perfect here (بینراوم); -ەوە needs the long one (نوێکراونەتەوە).
        const ended = (suf ? perfectLong : perfectShort)[p];
        emit(`${passivePast}و${ended}`, { tense: "present_perfect", ...passive });
        emit(`${NE}${passivePast}و${ended}`, { tense: "present_perfect", polarity: "neg", ...passive });
        emit(set1Past(passivePast + BUU, p), { tense: "past_perfect", ...passive });
        emit(NE + set1Past(passivePast + BUU, p), { tense: "past_perfect", polarity: "neg", ...passive });
        for (const [mark, tense] of pastSubjunctives) {
          emit(set1Past(passivePast + mark, p), { tense, mood: "subjunctive", ...passive });
          emit(NE + set1Past(passivePast + mark, p), {
            tense,
            mood: "subjunctive",
            polarity: "neg",
            ...passive,
          });
        }
      }
    } else {
      emit(set1Past(past, p), { tense: "past", aspect: "perfective", person: p, alignment: "accusative" });
      if (p === "2sg") emit(past + YEH, { tense: "past", aspect: "perfective", person: p, variant: "short" });
      emit(NE + set1Past(past, p), { tense: "past", aspect: "perfective", person: p, polarity: "neg" });
      emit(DE + set1Past(past, p), { tense: "past", aspect: "progressive", person: p });
      emit(NE + DE + set1Past(past, p), { tense: "past", aspect: "progressive", person: p, polarity: "neg" });
      const perfect = perfectBase(past);
      // The long ending is the written form and carries -ەوە (هاتوومە, چووینەتەوە); هاتووم is spoken.
      emit(perfect + perfectLong[p], { tense: "present_perfect", person: p });
      emit(NE + perfect + perfectLong[p], { tense: "present_perfect", person: p, polarity: "neg" });
      if (!suf && perfectShort[p] !== perfectLong[p]) {
        emit(perfect + perfectShort[p], { tense: "present_perfect", person: p, variant: "short" });
        emit(NE + perfect + perfectShort[p], {
          tense: "present_perfect",
          person: p,
          polarity: "neg",
          variant: "short",
        });
      }
      emit(set1Past(past + BUU, p), { tense: "past_perfect", person: p });
      emit(NE + set1Past(past + BUU, p), { tense: "past_perfect", person: p, polarity: "neg" });
      for (const [mark, tense] of subjunctives) {
        emit(set1Past(past + mark, p), { tense, mood: "subjunctive", person: p });
        emit(NE + set1Past(past + mark, p), { tense, mood: "subjunctive", person: p, polarity: "neg" });
      }
    }
  }
  emit(cell("present", "3sg", DE + set1Present(pres, "3sg")) + AE, {
    tense: "present",
    person: "3sg",
    goal: "yes",
  });
  if (!transitive && !(past.endsWith(ALEF) || past.endsWith(WW) || past.endsWith(YEH))) {
    emit(past + AE, { tense: "past", person: "3sg", goal: "yes" });
  }
  if (transitive) {
    // The agent clitic is often hosted by an earlier word, so the bare forms exist too.
    const external = { agent: "external", alignment: "ergative" };
    emit(past, { tense: "past", aspect: "perfective", ...external });
    emit(NE + past, { tense: "past", aspect: "perfective", polarity: "neg", ...external });
    emit(DE + past, { tense: "past", aspect: "progressive", ...external });
    emit(perfectBase(past) + AE, { tense: "present_perfect", ...external });
    emit(NE + perfectBase(past) + AE, { tense: "present_perfect", polarity: "neg", ...external });
    emit(past + BUU, { tense: "past_perfect", ...external });
    emit(NE + past + BUU, { tense: "past_perfect", polarity: "neg", ...external });
    for (const [mark, tense] of subjunctives) {
      emit(past + mark, { tense, mood: "subjunctive", ...external });
      emit(NE + past + mark, { tense, mood: "subjunctive", polarity: "neg", ...external });
    }
    if (pre) {
      for (const p of PERSONS) {
        const agent = { agent: p, alignment: "ergative" };
        for (const [neg, polarity] of [
          ["", {}],
          [NE, { polarity: "neg" }],
        ] as [string, Features][]) {
          const first = clitics[p] + neg;
          emit(first + past, { tense: "past", aspect: "perfective", ...agent, ...polarity });
          emit(first + DE + past, { tense: "past", aspect: "progressive", ...agent, ...polarity });
          emit(first + perfectBase(past) + AE, { tense: "present_perfect", ...agent, ...polarity });
          emit(first + past + BUU, { tense: "past_perfect", ...agent, ...polarity });
          for (const [mark, tense] of subjunctives) {
            emit(first + past + mark, { tense, mood: "subjunctive", ...agent, ...polarity });
          }
        }
      }
    }
  }
  if (past.endsWith(YEH)) {
    // نووسیووە, بینیووە: common with two و, recognised but not shown
    const third: Features = transitive ? { agent: "external", alignment: "ergative" } : { person: "3sg" };
    emit(`${past}ووە`, { tense: "present_perfect", variant: "double_u", ...third });
    emit(`${NE}${past}ووە`, { tense: "present_perfect", polarity: "neg", variant: "double_u", ...third });
  }
  // دەژی, also دەژێت; a guessed دزیان must not take دەدزێت from دزین
  if (pres.endsWith(YEH) && !cliticPresent && verb.source === "core") {
    emit(`${DE}${pres.slice(0, -1)}ێت`, {
      tense: "present",
      mood: "indicative",
      person: "3sg",
      variant: "root_i",
    });
  }
  if (base === "هاتن") {
    // نایەم is the common spelling; نایێم is argued for and recognised.
    for (const [i, end] of ["ێم", "ێیت", "ێت", "ێین", "ێن", "ێن"].entries()) {
      const person = PERSONS[i] as Person;
      emit(`نای${end}`, { tense: "present", mood: "indicative", person, polarity: "neg", variant: "ye" });
      emit(`نەی${end}`, { tense: "present", mood: "subjunctive", person, polarity: "neg", variant: "ye" });
    }
  }
  const imperative = vowelFinal(pres) ? pres : pres + AE;
  for (const [key, form] of Object.entries(irregularVariants[base] ?? {})) {
    const [name, person] = key.split("|") as [string, string];
    const polarity: Features = name === "prohibitive" ? { polarity: "neg" } : {};
    emit(form, { mood: "imperative", person, variant: "other", ...polarity });
  }
  // بکەرەوە: older or Sulaimani, recognised
  if (suf && imperative.endsWith(AE) && !cliticPresent) {
    push(`${pre}${BE}${imperative}رەوە`, { mood: "imperative", person: "2sg", variant: "er" });
  }
  if (cliticPresent) {
    // بتەوێ, مەتەوێ: rare
    for (const [person, clitic] of [
      ["2sg", "ت"],
      ["2pl", "تان"],
    ] as const) {
      emit(`${BE}${clitic}ەوێ`, { mood: "imperative", person });
      emit(`${ME}${clitic}ەوێ`, { mood: "imperative", person, polarity: "neg" });
    }
  } else {
    emit(cell("imperative", "2sg", BE + imperative), { mood: "imperative", person: "2sg" });
    emit(cell("imperative", "2pl", BE + pres + NUN), { mood: "imperative", person: "2pl" });
    if (irregular["imperative|2sg"] === undefined) noB(imperative, { mood: "imperative", person: "2sg" });
    if (irregular["imperative|2pl"] === undefined) noB(pres + NUN, { mood: "imperative", person: "2pl" });
    emit(cell("prohibitive", "2sg", ME + imperative), { mood: "imperative", person: "2sg", polarity: "neg" });
    emit(cell("prohibitive", "2pl", ME + pres + NUN), { mood: "imperative", person: "2pl", polarity: "neg" });
  }
  forms.push({ form: lemma, lemma, features: { pos: "VERB", form: "infinitive" } });
  emit(perfectBase(past), { form: "past_participle" });
  emit(NE + perfectBase(past), { form: "past_participle", polarity: "neg" });
  if (transitive && !cliticPresent && !noPassive.has(lemma)) {
    emit(`${passiveStem(verb)}او`, { form: "passive_participle" });
  }
  return forms;
}

/**
 * How the written standard spaces a form: هەڵم گرت, نان دەکەم, دەستم پێ کرد. Solid forms stay accepted input.
 * A clitic on the first part always splits the verb; without one, only some verbs are written apart.
 */
export function standardSpelling(verb: Verb, form: VerbForm): string {
  const pre = verb.preverb;
  if (!pre || !form.form.startsWith(pre) || form.features["variant"]) return form.form;
  const rest = form.form.slice(pre.length);
  // دەستپێکردن has two first parts: دەست پێ دەکەم, and the clitic goes on the noun: دەستم پێ کرد
  let head = pre;
  let adposition = "";
  if (!preverbs.includes(pre) && (pre.endsWith("پێ") || pre.endsWith("تێ") || pre.endsWith("لێ"))) {
    head = pre.slice(0, -2);
    adposition = pre.slice(-2);
  }
  const clitic = clitics[form.features["agent"] as Person];
  if (clitic && rest.startsWith(clitic)) {
    return [head + clitic, adposition, rest.slice(clitic.length)].filter((part) => part !== "").join(" ");
  }
  if (alwaysSplit(verb)) return [head, adposition, rest].filter((part) => part !== "").join(" ");
  return form.form;
}

const withoutPerson = (features: Features): string =>
  JSON.stringify(
    Object.entries(features)
      .filter(([key]) => key !== "person")
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );

/** Surface form to analyses. Persons that share a form become one reading such as 2pl|3pl. */
export class FormIndex {
  readonly verbs = new Map<string, Verb>();
  private readonly index = new Map<string, VerbForm[]>();

  constructor(verbs: Iterable<Verb> = []) {
    for (const verb of verbs) this.add(verb);
  }

  add(verb: Verb): void {
    if (this.verbs.has(verb.infinitive)) return;
    this.verbs.set(verb.infinitive, verb);
    const hidden = hiddenForms[verb.infinitive] ?? [];
    for (const form of conjugate(verb)) if (!hidden.includes(form.form)) this.addForm(form);
  }

  private addForm(form: VerbForm): void {
    let same = this.index.get(form.form);
    if (same === undefined) {
      same = [];
      this.index.set(form.form, same);
    }
    const person = form.features["person"];
    if (person) {
      const rest = withoutPerson(form.features);
      for (const [i, other] of same.entries()) {
        const existing = other.features["person"];
        if (other.lemma === form.lemma && existing !== undefined && rest === withoutPerson(other.features)) {
          const persons = existing.split("|");
          if (!persons.includes(person)) {
            const merged = [...persons, person].sort().join("|");
            same[i] = { ...other, features: { ...other.features, person: merged } };
          }
          return;
        }
      }
    }
    same.push(form);
  }

  lookup(form: string): readonly VerbForm[] {
    return this.index.get(form) ?? [];
  }

  /**
   * A verb written over several tokens: هەڵم گرت, ڕای گەیاند, دەست پێ دەکەم, دەستم پێ کرد. The tokens before
   * the last must be exactly the verb's first part, with or without a clitic, so that an ordinary pair of
   * words does not join.
   */
  lookupSplit(tokens: readonly string[]): [span: number, form: VerbForm] | null {
    const endings = Object.values(clitics);
    for (const n of [3, 2]) {
      if (tokens.length < n) continue;
      const head = tokens.slice(0, n - 1);
      const last = tokens[n - 1] as string;
      const keys: [first: string, clitic: string][] = [[head.join(""), ""]];
      if (n === 3) {
        // دەستم پێ کرد: the clitic is on the noun, and the form has it after پێ.
        const [noun, adposition] = head as [string, string];
        for (const clitic of endings) {
          if (noun.endsWith(clitic)) keys.push([noun.slice(0, -clitic.length) + adposition, clitic]);
        }
      }
      for (const [first, clitic] of keys) {
        for (const form of this.lookup(first + clitic + last)) {
          const pre = (this.verbs.get(form.lemma) as Verb).preverb;
          const firstParts = [pre, ...endings.map((ending) => pre + ending)];
          if (pre && !form.features["variant"] && firstParts.includes(first)) return [n, form];
        }
      }
    }
    return null;
  }
}

let defaultFormIndex: FormIndex | undefined;

/** The index of the core verbs, built once. */
export function defaultIndex(): FormIndex {
  if (defaultFormIndex === undefined) {
    const core = loadCoreVerbs();
    const known = new Map(core.filter((v) => !v.preverb && !v.suffix).map((v) => [v.infinitive, v]));
    defaultFormIndex = new FormIndex(
      core.map((v) => makeVerb(v.infinitive, v.transitive, v.present, "core", known) ?? v),
    );
  }
  return defaultFormIndex;
}
