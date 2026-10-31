import { hasFullFixture, readFixture } from "@zimanyar/data/node";
import { describe, it } from "vitest";
import { decline, type Gender, KmrAnalyzer } from "../src/kmr/morphology.js";
import { lower, normalizeOnce as normalize, upper, validateWord } from "../src/kmr/orthography.js";
import { segments, syllables, toIpa } from "../src/kmr/phonology.js";
import { type AlignmentRecord, detectAlignment } from "../src/kmr/syntax.js";
import { toArabic } from "../src/kmr/translit.js";
import { conjugate, loadCoreVerbs, makeVerb, type Verb } from "../src/kmr/verbs.js";
import { round } from "../src/python.js";
import { type Analysis, SimpleLexicon } from "../src/schema.js";
import { expectParity } from "./parity-helpers.js";

interface AnalyzeLine {
  input: string;
  readings: Analysis[];
}
interface AlignmentLine {
  sentence: string;
  verb: string | null;
  lemma: string | null;
  tense_stem: string | null;
  transitive: boolean | null;
  alignment: string | null;
  agent: unknown;
  object: unknown;
  verb_person: string | null;
  controller: string | null;
  agreement_ok: boolean | null;
  notes: string[];
}
const topThree = (analyzer: KmrAnalyzer, word: string) =>
  analyzer
    .analyze(word)
    .slice(0, 3)
    .map((reading) => ({ ...reading, score: round(reading.score, 6) }));
const asFixture = (r: AlignmentRecord): AlignmentLine => {
  const { tenseStem, verbPerson, agreementOk, ...rest } = r;
  return { ...rest, tense_stem: tenseStem, verb_person: verbPerson, agreement_ok: agreementOk };
};
function fullLexicon(): SimpleLexicon {
  const lexicon = new SimpleLexicon();
  interface Lemma {
    lemma: string;
    pos: string;
    gender: string | null;
    frequency: number;
  }
  for (const row of readFixture<Lemma>("kmr_lemmas"))
    lexicon.add(row.lemma, row.pos, row.gender, row.frequency);
  return lexicon;
}

describe("parity with zimankit: Kurmanji", () => {
  it("orthography", () => {
    interface Line {
      input: string;
      lower: string;
      upper: string;
      normalize: string;
      normalize_word: string;
      normalize_word_case: string;
      normalize_no_apostrophe: string;
      validate_word: string[];
    }
    expectParity<Line>("kmr_orthography", (r) => ({
      actual: [
        lower(r.input),
        upper(r.input),
        normalize(r.input),
        normalize(r.input, { lowercase: true }),
        normalize(r.input, { lowercase: false }),
        normalize(r.input, { lowercase: true, keepApostrophe: false }),
        validateWord(r.input),
      ],
      expected: [
        r.lower,
        r.upper,
        r.normalize,
        r.normalize_word,
        r.normalize_word_case,
        r.normalize_no_apostrophe,
        r.validate_word,
      ],
    }));
  });

  it("phonology and the Arabic script", () => {
    interface Line {
      input: string;
      ipa: string;
      ipa_narrow: string;
      ipa_narrow_marked: string;
      ipa_plain: string;
      syllables: string[];
      arabic: string;
      segments: [string, string][];
    }
    expectParity<Line>("kmr_phonology", (r) => ({
      actual: [
        toIpa(r.input),
        toIpa(r.input, { narrow: true }),
        toIpa(r.input, { narrow: true, syllableDots: true }, true),
        toIpa(r.input, { reducedSuffixI: false, syllableDots: true }, true),
        syllables(r.input),
        toArabic(r.input),
        segments(r.input),
      ],
      expected: [r.ipa, r.ipa_narrow, r.ipa_narrow_marked, r.ipa_plain, r.syllables, r.arabic, r.segments],
    }));
  });

  it("verbs: building and paradigms", () => {
    interface Line {
      verb: Verb | null;
      made_from: { infinitive: string; transitive: boolean; present: string | null } | null;
      forms: [string, string, Record<string, string>][];
    }
    const known = new Map(loadCoreVerbs().map((v) => [v.infinitive, v]));
    expectParity<Line>("kmr_verbs", (r) => {
      const verb = r.made_from
        ? makeVerb(r.made_from.infinitive, r.made_from.transitive, r.made_from.present, "guess", known)
        : known.get((r.verb as Verb).infinitive);
      const forms = verb ? conjugate(verb).map((f) => [f.form, f.lemma, f.features]) : [];
      return { actual: [verb, forms], expected: [r.verb, r.forms] };
    });
  });

  it("declension", () => {
    interface Line {
      stem: string;
      gender: Gender;
      forms: [string, string | null][];
    }
    expectParity<Line>("kmr_decline", (r) => ({ actual: decline(r.stem, r.gender), expected: r.forms }));
  });

  it("the analyzer without a lexicon", () => {
    const analyzer = new KmrAnalyzer();
    expectParity<AnalyzeLine>("kmr_analyze_no_lexicon", (r) => ({
      actual: topThree(analyzer, r.input),
      expected: r.readings,
    }));
  });

  it("the ergativity checker without a lexicon", () => {
    const analyzer = new KmrAnalyzer();
    expectParity<AlignmentLine>("kmr_alignment_no_lexicon", (r) => ({
      actual: asFixture(detectAlignment(r.sentence, analyzer)),
      expected: r,
    }));
  });

  it.skipIf(!hasFullFixture("kmr_lemmas"))(
    "the analyzer and the ergativity checker with the full lexicon",
    () => {
      const analyzer = new KmrAnalyzer(fullLexicon());
      expectParity<AnalyzeLine>("kmr_analyze", (r) => ({
        actual: topThree(analyzer, r.input),
        expected: r.readings,
      }));
      expectParity<AlignmentLine>("kmr_alignment", (r) => ({
        actual: asFixture(detectAlignment(r.sentence, analyzer)),
        expected: r,
      }));
    },
  );
});
