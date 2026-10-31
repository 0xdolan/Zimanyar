import {
  CKB_CLITIC_SUBJECT_PRESENT,
  CKB_IRREGULAR,
  CKB_PASSIVE_STEM,
  CKB_PREVERBS,
  CKB_SET2,
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
export function guessPresentStem(past: string): string {
  if (past.endsWith("اند")) return `${past.slice(0, -3)}ێن`;
  if (past.endsWith("ارد")) return `${past.slice(0, -3)}ێر`;
  if (past.endsWith(ALEF) || past.endsWith(YEH)) return past.slice(0, -1);
  if (past.endsWith("شت") || past.endsWith("ست")) return past.slice(0, -1);
  if (past.endsWith("ت") || past.endsWith("د")) return past.slice(0, -1);
  if (past.endsWith(WW)) return past.slice(0, -2);
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
  for (const preverb of CKB_PREVERBS) {
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
      return build(base, preverb, !CKB_PREVERBS.includes(preverb));
    }
  }
  const past = pastStemOf(core);
  if (!past) return null;
  return {
    infinitive,
    past,
    present: present || guessPresentStem(past),
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
  if (form.endsWith(YEH)) return `${form}ەوە`;
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
const PERFECT_ENDINGS: Record<Person, string> = {
  "1sg": "م",
  "2sg": "یت",
  "3sg": AE,
  "1pl": "ین",
  "2pl": NUN,
  "3pl": NUN,
};

/** Every single-word form of a verb, with its features, in zimankit's order. */
export function conjugate(verb: Verb): VerbForm[] {
  const { preverb: pre, suffix: suf, infinitive: lemma, present: pres, past, transitive, light } = verb;
  const base = baseInfinitive(verb);
  const irregular = irregulars[base] ?? {};
  const cell = (name: string, person: string, regular: string) => irregular[`${name}|${person}`] ?? regular;
  const forms: VerbForm[] = [];
  const emit = (surface: string, features: Features) => {
    forms.push({ form: withSuffix(pre + surface, suf), lemma, features: { pos: "VERB", ...features } });
  };
  const cliticPresent = cliticPresents[base];
  const b = pre && !light ? "" : BE;

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
      emit(cell("subjunctive", p, b + stem), { tense: "present", mood: "subjunctive", person: p });
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
      emit(past + clitic, { tense: "past", aspect: "perfective", ...ergative });
      emit(NE + clitic + past, {
        tense: "past",
        aspect: "perfective",
        agent: p,
        polarity: "neg",
        alignment: "ergative",
      });
      emit(DE + clitic + past, { tense: "past", aspect: "progressive", ...ergative });
      emit(NE + clitic + DE + past, {
        tense: "past",
        aspect: "progressive",
        agent: p,
        polarity: "neg",
        alignment: "ergative",
      });
      emit(perfectBase(past) + PERFECT_CLITICS[p], { tense: "present_perfect", ...ergative });
      emit(past + BUU + clitic, { tense: "past_perfect", ...ergative });
      if (!cliticPresent) {
        const stem = passiveStem(verb);
        emit(DE + stem + set1Present(LONG_E, p), { tense: "present", voice: "passive", person: p });
        emit(NA + stem + set1Present(LONG_E, p), {
          tense: "present",
          voice: "passive",
          person: p,
          polarity: "neg",
        });
        emit(set1Past(stem + ALEF, p), { tense: "past", voice: "passive", person: p });
      }
    } else {
      emit(set1Past(past, p), { tense: "past", aspect: "perfective", person: p, alignment: "accusative" });
      if (p === "2sg") emit(past + YEH, { tense: "past", aspect: "perfective", person: p, variant: "short" });
      emit(NE + set1Past(past, p), { tense: "past", aspect: "perfective", person: p, polarity: "neg" });
      emit(DE + set1Past(past, p), { tense: "past", aspect: "progressive", person: p });
      emit(NE + DE + set1Past(past, p), { tense: "past", aspect: "progressive", person: p, polarity: "neg" });
      emit(perfectBase(past) + PERFECT_ENDINGS[p], { tense: "present_perfect", person: p });
      emit(set1Past(past + BUU, p), { tense: "past_perfect", person: p });
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
    emit(past + BUU, { tense: "past_perfect", ...external });
    if (pre) {
      // With a preverb the clitic sits right after it.
      for (const p of PERSONS) {
        forms.push({
          form: withSuffix(pre + clitics[p] + past, suf),
          lemma,
          features: { pos: "VERB", tense: "past", aspect: "perfective", agent: p, alignment: "ergative" },
        });
      }
    }
  }
  const imperative = vowelFinal(pres) ? pres : pres + AE;
  if (!cliticPresent) {
    emit(cell("imperative", "2sg", b + imperative), { mood: "imperative", person: "2sg" });
    emit(cell("imperative", "2pl", b + pres + NUN), { mood: "imperative", person: "2pl" });
    emit(cell("prohibitive", "2sg", ME + imperative), { mood: "imperative", person: "2sg", polarity: "neg" });
    emit(cell("prohibitive", "2pl", ME + pres + NUN), { mood: "imperative", person: "2pl", polarity: "neg" });
  }
  forms.push({ form: lemma, lemma, features: { pos: "VERB", form: "infinitive" } });
  emit(perfectBase(past), { form: "past_participle" });
  if (transitive && !cliticPresent) {
    const stem = passiveStem(verb);
    emit(`${stem}او`, { form: "passive_participle" });
    emit(`${stem}اوە`, { tense: "present_perfect", voice: "passive", person: "3sg" });
  }
  return forms;
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
    for (const form of conjugate(verb)) this.addForm(form);
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
