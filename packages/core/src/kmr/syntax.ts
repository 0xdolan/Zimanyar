import { KMR_DIRECT_PRONOUNS, KMR_OBLIQUE_PRONOUNS, KMR_PRONOUN_PERSON } from "../generated/tables.js";
import type { Analysis } from "../schema.js";
import { words } from "../tokenize.js";
import { KmrAnalyzer } from "./morphology.js";

/** What the checker needs of an analyzer, so a caller can supply a cached one. */
export interface WordAnalyzer {
  analyze(word: string): readonly Analysis[];
  best(word: string): Analysis | null;
}

const directPronouns = new Set(KMR_DIRECT_PRONOUNS);
const obliquePronouns = new Set(KMR_OBLIQUE_PRONOUNS);
const pronounPerson = KMR_PRONOUN_PERSON as Record<string, string>;
const PREPOSITIONS = new Set(["di", "ji", "bi", "li", "bo", "ber", "ser", "nav", "ligel", "digel"]);
const PAST_TENSES = new Set(["past", "present_perfect", "past_perfect"]);

export interface Argument {
  token: string;
  index: number;
  case: string;
  person: string | null;
}

export interface AlignmentRecord {
  sentence: string;
  verb: string | null;
  lemma: string | null;
  tenseStem: "present" | "past" | null;
  transitive: boolean | null;
  alignment: "ergative" | "accusative" | null;
  agent: Argument | null;
  object: Argument | null;
  verbPerson: string | null;
  /** Which argument the verb should agree with. */
  controller: "object" | "subject" | null;
  agreementOk: boolean | null;
  notes: string[];
}

function caseOf(token: string, reading: Analysis | null): [string, string | null] {
  const lowered = token.toLowerCase();
  if (directPronouns.has(lowered)) return ["dir", pronounPerson[lowered] as string];
  if (obliquePronouns.has(lowered)) return ["obl", pronounPerson[lowered] as string];
  if (reading === null || !["NOUN", "PROPN", "ADJ"].includes(reading.pos)) return ["none", null];
  const person = (reading.features["number"] ?? "sg") === "pl" ? "pl" : "3sg";
  if (reading.features["case"] === "obl") return ["obl", person];
  if (reading.features["ezafe"]) return ["ezafe", person];
  return ["dir", person];
}

/**
 * Find a clause's finite verb, decide which alignment applies, pick the agent and object by case,
 * and check that the verb's ending agrees with the argument it should. In the past of a transitive
 * verb that is the object: Min tu dîtî.
 */
export function detectAlignment(
  sentence: string,
  analyzer: WordAnalyzer = new KmrAnalyzer(),
): AlignmentRecord {
  const tokens = words(sentence);
  const record: AlignmentRecord = {
    sentence,
    verb: null,
    lemma: null,
    tenseStem: null,
    transitive: null,
    alignment: null,
    agent: null,
    object: null,
    verbPerson: null,
    controller: null,
    agreementOk: null,
    notes: [],
  };
  const analyses = tokens.map((token) => analyzer.best(token));
  // The finite verb is the last token with a finite verbal reading.
  let verbAt = -1;
  let verbReading: Analysis | null = null;
  for (let i = tokens.length - 1; i >= 0 && verbReading === null; i--) {
    for (const reading of analyzer.analyze(tokens[i] as string)) {
      if (
        reading.pos === "VERB" &&
        "person" in reading.features &&
        reading.features["mood"] !== "imperative"
      ) {
        verbAt = i;
        verbReading = reading;
        analyses[i] = reading;
        break;
      }
    }
  }
  if (verbReading === null) {
    record.notes.push("no finite verb found");
    return record;
  }
  record.verb = tokens[verbAt] as string;
  record.lemma = verbReading.lemma;
  record.verbPerson = verbReading.features["person"] ?? null;
  record.transitive = verbReading.features["transitivity"] === "transitive";
  const past = PAST_TENSES.has(verbReading.features["tense"] ?? "");
  record.tenseStem = past ? "past" : "present";
  record.alignment = past && record.transitive ? "ergative" : "accusative";

  const args: Argument[] = [];
  for (let i = 0; i < verbAt; i++) {
    const token = tokens[i] as string;
    const [argumentCase, person] = caseOf(token, analyses[i] as Analysis | null);
    if (argumentCase !== "dir" && argumentCase !== "obl") continue;
    // The object of a preposition is not a core argument.
    const previous = i > 0 ? (tokens[i - 1] as string).toLowerCase() : "";
    if (!PREPOSITIONS.has(previous)) args.push({ token, index: i, case: argumentCase, person });
  }
  const oblique = args.filter((argument) => argument.case === "obl");
  const direct = args.filter((argument) => argument.case === "dir");
  const firstOblique = oblique[0] ?? null;
  const firstDirect = direct[0] ?? null;
  let target: Argument | null;
  if (record.alignment === "ergative") {
    record.agent = firstOblique;
    record.object = firstDirect;
    record.controller = "object";
    target = record.object;
    if (record.agent === null) record.notes.push("ergative clause without an overt oblique agent (pro-drop)");
    if (firstDirect && firstOblique && firstDirect.index < firstOblique.index) {
      record.notes.push("object precedes agent (marked order)");
    }
  } else {
    record.agent = firstDirect;
    record.object = firstOblique && record.transitive ? firstOblique : null;
    record.controller = "subject";
    target = record.agent;
    if (firstOblique && !firstDirect && !past && record.transitive) {
      record.notes.push("oblique-case subject with a present-tense verb: check agreement");
    }
  }
  if (target?.person && record.verbPerson) {
    record.agreementOk = target.person.split("|").includes(record.verbPerson);
    if (!record.agreementOk) {
      record.notes.push(
        `verb ending marks ${record.verbPerson} but ${record.controller} '${target.token}' is ${target.person}`,
      );
    }
  } else if (target === null) {
    record.notes.push(`${record.controller} not overt; verb ending marks ${record.verbPerson}`);
  }
  return record;
}
