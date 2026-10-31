import { hasFullFixture, readFixture } from "@zimanyar/data/node";
import { describe, it } from "vitest";
import { CkbAnalyzer, decline } from "../src/ckb/morphology.js";
import {
  isLegacyEncoded,
  normalize,
  normalizeWord,
  spellingVariants,
  validateWord,
} from "../src/ckb/orthography.js";
import { segments, syllables, toIpa, toLatin } from "../src/ckb/phonology.js";
import { conjugate, loadCoreVerbs, makeVerb, type Verb } from "../src/ckb/verbs.js";
import { round } from "../src/python.js";
import { type Analysis, SimpleLexicon } from "../src/schema.js";
import { expectParity } from "./parity-helpers.js";

interface AnalyzeLine {
  input: string;
  readings: Analysis[];
}
const topThree = (analyzer: CkbAnalyzer, word: string) =>
  analyzer
    .analyze(word)
    .slice(0, 3)
    .map((reading) => ({ ...reading, score: round(reading.score, 6) }));

describe("parity with zimankit: Sorani", () => {
  it("orthography", () => {
    interface Line {
      input: string;
      normalize: string;
      normalize_word: string;
      normalize_legacy: string;
      normalize_off: string;
      validate_word: string[];
      is_legacy_encoded: boolean;
      spelling_variants: string[];
    }
    expectParity<Line>("ckb_orthography", (r) => ({
      actual: [
        normalize(r.input),
        normalizeWord(r.input),
        normalize(r.input, { legacy: "yes", digits: "latin" }),
        normalize(r.input, {
          legacy: "no",
          fixInitialR: false,
          addInitialHamza: false,
          kurdishPunctuation: false,
          digits: "keep",
        }),
        validateWord(r.input),
        isLegacyEncoded(r.input),
        spellingVariants(r.input),
      ],
      expected: [
        r.normalize,
        r.normalize_word,
        r.normalize_legacy,
        r.normalize_off,
        r.validate_word,
        r.is_legacy_encoded,
        r.spelling_variants,
      ],
    }));
  });

  it("phonology", () => {
    interface Line {
      input: string;
      ipa: string;
      ipa_plain: string;
      syllables: string[];
      latin: string;
      latin_accented: string;
      segments: [string, string][];
    }
    expectParity<Line>("ckb_phonology", (r) => ({
      actual: [
        toIpa(r.input),
        toIpa(
          r.input,
          { markEpenthesis: false, glottalOnset: false, hiatusGlides: false, syllableDots: true },
          true,
        ),
        syllables(r.input),
        toLatin(r.input),
        toLatin(r.input, "accented"),
        segments(r.input),
      ],
      expected: [r.ipa, r.ipa_plain, r.syllables, r.latin, r.latin_accented, r.segments],
    }));
  });

  it("verbs: building and paradigms", () => {
    interface Line {
      verb: Verb | null;
      made_from: { infinitive: string; transitive: boolean; present: string | null } | null;
      forms: [string, string, Record<string, string>][];
    }
    const known = new Map(loadCoreVerbs().map((v) => [v.infinitive, v]));
    expectParity<Line>("ckb_verbs", (r) => {
      const verb = r.made_from
        ? makeVerb(r.made_from.infinitive, r.made_from.transitive, r.made_from.present, "guess", known)
        : r.verb;
      const forms = verb ? conjugate(verb).map((f) => [f.form, f.lemma, f.features]) : [];
      return { actual: [verb, forms], expected: [r.verb, r.forms] };
    });
  });

  it("the core verb list", () => {
    const known = new Map(loadCoreVerbs().map((v) => [v.infinitive, v]));
    expectParity<{ verb: Verb; made_from: unknown }>("ckb_verbs", (r) => ({
      actual: r.made_from === null ? known.get(r.verb.infinitive) : null,
      expected: r.made_from === null ? r.verb : null,
    }));
  });

  it("declension", () => {
    interface Line {
      stem: string;
      forms: [string, string | null][];
    }
    expectParity<Line>("ckb_decline", (r) => ({ actual: decline(r.stem), expected: r.forms }));
  });

  it("the analyzer without a lexicon", () => {
    const analyzer = new CkbAnalyzer();
    expectParity<AnalyzeLine>("ckb_analyze_no_lexicon", (r) => ({
      actual: topThree(analyzer, r.input),
      expected: r.readings,
    }));
  });

  it.skipIf(!hasFullFixture("ckb_lemmas"))("the analyzer with the full lexicon", () => {
    const lexicon = new SimpleLexicon();
    interface Lemma {
      lemma: string;
      pos: string;
      gender: string | null;
      frequency: number;
    }
    for (const row of readFixture<Lemma>("ckb_lemmas"))
      lexicon.add(row.lemma, row.pos, row.gender, row.frequency);
    const analyzer = new CkbAnalyzer(lexicon);
    expectParity<AnalyzeLine>("ckb_analyze", (r) => ({
      actual: topThree(analyzer, r.input),
      expected: r.readings,
    }));
  });
});
