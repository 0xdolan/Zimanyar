import {
  KMR_NI_NEGATION,
  KMR_PERSONS,
  KMR_PREVERBS,
  KMR_VERBS_CORE_TSV,
  KMR_VOWELS,
} from "../generated/tables.js";

type Features = Record<string, string>;

const vowels = new Set(KMR_VOWELS);
const niNegation = new Set(KMR_NI_NEGATION);
const isVowelFinal = (stem: string) => vowels.has(stem.at(-1) as string);

export interface Verb {
  infinitive: string;
  past: string;
  present: string;
  transitive: boolean;
  preverb: string;
  source: string;
}

export interface VerbForm {
  form: string;
  lemma: string;
  features: Features;
}

export function loadCoreVerbs(): Verb[] {
  const verbs: Verb[] = [];
  for (const line of KMR_VERBS_CORE_TSV.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [infinitive = "", past = "", present = "", transitive = "", preverb = ""] = line
      .split("\t")
      .map((column) => column.trim());
    verbs.push({ infinitive, past, present, transitive: transitive === "T", preverb, source: "core" });
  }
  return verbs;
}

export function pastStemOf(infinitive: string): string | null {
  if (infinitive.endsWith("in") && infinitive.length > 3 && !vowels.has(infinitive.at(-3) as string)) {
    return infinitive.slice(0, -2);
  }
  if (infinitive.endsWith("n") && infinitive.length > 2 && "aîûe".includes(infinitive.at(-2) as string)) {
    return infinitive.slice(0, -1);
  }
  return null;
}

/** Regular patterns only: -and gives -în (causative), -î is dropped, otherwise the past stem. */
export function guessPresentStem(past: string): string {
  if (past.endsWith("and")) return `${past.slice(0, -3)}în`;
  if (past.endsWith("î") && past.length > 2) return past.slice(0, -1);
  if (past.endsWith("t") && past.length > 2 && "sş".includes(past.at(-2) as string)) return past.slice(0, -1);
  return past;
}

export function makeVerb(
  infinitive: string,
  transitive: boolean | null = null,
  present: string | null = null,
  source = "guess",
  known: ReadonlyMap<string, Verb> = new Map(),
): Verb | null {
  const existing = known.get(infinitive);
  if (existing) return existing;
  for (const preverb of KMR_PREVERBS) {
    const base = known.get(infinitive.slice(preverb.length));
    if (infinitive.startsWith(preverb) && base) {
      return {
        infinitive,
        past: base.past,
        present: base.present,
        transitive: transitive ?? base.transitive,
        preverb,
        source,
      };
    }
  }
  const past = pastStemOf(infinitive);
  if (!past) return null;
  return {
    infinitive,
    past,
    present: present || guessPresentStem(past),
    transitive: transitive ?? true,
    preverb: "",
    source,
  };
}

/** Attach a suffix; a stem-final î shortens to i before y: anî+yî gives aniyî. */
function join(stem: string, suffix: string): string {
  return stem.endsWith("î") && suffix.startsWith("y") ? `${stem.slice(0, -1)}i${suffix}` : stem + suffix;
}

type Person = "1sg" | "2sg" | "3sg" | "pl";
const AFTER_VOWEL: Record<Person, string> = { "1sg": "m", "2sg": "yî", "3sg": "", pl: "n" };
const PRESENT_ENDINGS: Record<Person, string> = { "1sg": "im", "2sg": "î", "3sg": "e", pl: "in" };
const PAST_ENDINGS: Record<Person, string> = { "1sg": "im", "2sg": "î", "3sg": "", pl: "in" };

function ending(stem: string, person: Person, tense: "present" | "past"): string {
  if (isVowelFinal(stem)) return AFTER_VOWEL[person];
  return (tense === "present" ? PRESENT_ENDINGS : PAST_ENDINGS)[person];
}

/** ê and î stems contract with the prefixes (têm, nayêm, bêm), and a stems merge na- (naxivim). */
function presentPrefix(verb: Verb, kind: "ind" | "neg" | "subj" | "negsubj"): string {
  const first = verb.present[0] as string;
  const contracts = first === "ê" || first === "î";
  const base = verb.infinitive.slice(verb.preverb.length);
  switch (kind) {
    case "ind":
      if (base === "rûniştin") return "";
      return contracts ? "t" : "di";
    case "neg":
      if (niNegation.has(base)) return "ni";
      return contracts ? "nay" : first === "a" ? "n" : "na";
    case "subj":
      if (verb.preverb) return "";
      return vowels.has(first) ? "b" : "bi";
    case "negsubj":
      return contracts ? "ney" : "ne";
  }
}

const PERFECT_AFTER_VOWEL: Record<Person, string> = { "1sg": "me", "2sg": "yî", "3sg": "ye", pl: "ne" };
const PERFECT_AFTER_CONSONANT: Record<Person, string> = {
  "1sg": "ime",
  "2sg": "iyî",
  "3sg": "iye",
  pl: "ine",
};

/** Every single-word form of a verb, with its features, in zimankit's order. */
export function conjugate(verb: Verb): VerbForm[] {
  const { preverb: pre, infinitive: lemma, present: pres, past, transitive } = verb;
  const base = lemma.slice(pre.length);
  const alignment = transitive ? "ergative" : "accusative";
  const agreement = transitive ? "object" : "subject";
  const forms: VerbForm[] = [];
  const emit = (surface: string, features: Features) => {
    forms.push({ form: pre + surface, lemma, features: { pos: "VERB", ...features } });
  };
  const pastFinal = isVowelFinal(past);
  for (const p of KMR_PERSONS as Person[]) {
    const e = ending(pres, p, "present");
    const subject = { person: p, agreement: "subject" };
    emit(presentPrefix(verb, "ind") + pres + e, { tense: "present", mood: "indicative", ...subject });
    emit(presentPrefix(verb, "neg") + pres + e, {
      tense: "present",
      mood: "indicative",
      ...subject,
      polarity: "neg",
    });
    emit(presentPrefix(verb, "subj") + pres + e, { mood: "subjunctive", ...subject });
    emit(presentPrefix(verb, "negsubj") + pres + e, { mood: "subjunctive", ...subject, polarity: "neg" });
    const pastForm = join(past, ending(past, p, "past"));
    const agrees = { person: p, agreement, alignment };
    emit(pastForm, { tense: "past", aspect: "perfective", ...agrees });
    emit(`ne${pastForm}`, { tense: "past", aspect: "perfective", ...agrees, polarity: "neg" });
    emit(`di${pastForm}`, { tense: "past", aspect: "progressive", ...agrees });
    emit(`nedi${pastForm}`, { tense: "past", aspect: "progressive", ...agrees, polarity: "neg" });
    const perfect = pastFinal ? PERFECT_AFTER_VOWEL : PERFECT_AFTER_CONSONANT;
    emit(join(past, perfect[p]), { tense: "present_perfect", ...agrees });
    const pluperfect = past + (pastFinal ? "bû" : "ibû");
    emit(pluperfect + ending(pluperfect, p, "past"), { tense: "past_perfect", ...agrees });
  }
  const presentFinal = isVowelFinal(pres);
  let imperatives: [string, string][];
  if (base === "hatin") {
    imperatives = [
      ["2sg", "were"],
      ["2pl", "werin"],
    ];
  } else if (base === "çûn") {
    imperatives = [
      ["2sg", "here"],
      ["2pl", "herin"],
    ];
  } else {
    const prefix = presentPrefix(verb, "subj");
    imperatives = [
      ["2sg", prefix + pres + (presentFinal ? "" : "e")],
      ["2pl", prefix + pres + (presentFinal ? "n" : "in")],
    ];
  }
  for (const [p, form] of imperatives) {
    emit(form, { mood: "imperative", person: p });
    const end = presentFinal ? (p === "2sg" ? "" : "n") : p === "2sg" ? "e" : "in";
    emit(presentPrefix(verb, "negsubj") + pres + end, { mood: "imperative", person: p, polarity: "neg" });
  }
  forms.push({ form: lemma, lemma, features: { pos: "VERB", form: "infinitive" } });
  emit(past + (pastFinal ? "yî" : "î"), { form: "past_participle" });
  return forms;
}

/** Surface form to analyses. */
export class FormIndex {
  readonly verbs = new Map<string, Verb>();
  private readonly index = new Map<string, VerbForm[]>();

  constructor(verbs: Iterable<Verb> = []) {
    for (const verb of verbs) this.add(verb);
  }

  add(verb: Verb): void {
    if (this.verbs.has(verb.infinitive)) return;
    this.verbs.set(verb.infinitive, verb);
    for (const form of conjugate(verb)) {
      const same = this.index.get(form.form);
      if (same) same.push(form);
      else this.index.set(form.form, [form]);
    }
  }

  lookup(form: string): readonly VerbForm[] {
    return this.index.get(form) ?? [];
  }
}

let defaultFormIndex: FormIndex | undefined;

/** The index of the core verbs, built once. */
export function defaultIndex(): FormIndex {
  defaultFormIndex ??= new FormIndex(loadCoreVerbs());
  return defaultFormIndex;
}
