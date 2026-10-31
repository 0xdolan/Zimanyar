import { describe, it } from "vitest";
import {
  breakClusters,
  charScript,
  cleanZwnj,
  damerauLevenshtein,
  detectScript,
  identify,
  legalCoda,
  legalOnset,
  levenshtein,
  normalizeText,
  type Segment,
  sentences,
  sonority,
  syllabify,
  tokenize,
  weightedDistance,
  words,
} from "../src/index.js";
import { round } from "../src/python.js";
import { expectParity } from "./parity-helpers.js";

/** Python offsets count code points; ours count UTF-16 units, so they are converted to compare. */
const toUtf16 = (text: string, offset: number) => Array.from(text).slice(0, offset).join("").length;

describe("parity with zimankit: shared", () => {
  it("normalizeText with options", () => {
    expectParity<Record<string, string>>("shared_normalize_options", (r) => {
      const input = r["input"] as string;
      return {
        actual: [
          normalizeText(input),
          normalizeText(input, { digits: "latin" }),
          normalizeText(input, { digits: "arabic-indic" }),
          normalizeText(input, {
            stripUrls: false,
            stripEmails: false,
            stripEmoji: false,
            collapseBlankLines: false,
          }),
          normalizeText(input, { stripMentions: true }),
        ],
        expected: [r["plain"], r["digits_latin"], r["digits_arabic"], r["keep_all"], r["strip_mentions"]],
      };
    });
  });

  it("text: cleaning, tokens, sentences, script", () => {
    interface Line {
      input: string;
      normalize_text: string;
      clean_zwnj: string;
      tokens: [string, string, number, number][];
      tokens_hyphen: [string, string, number, number][];
      words: string[];
      sentences: string[];
      script: string;
    }
    const tokens = (text: string, keep: boolean) =>
      tokenize(text, keep).map((t) => [t.text, t.kind, t.start, t.end]);
    const converted = (text: string, rows: Line["tokens"]) =>
      rows.map(([t, k, s, e]) => [t, k, toUtf16(text, s), toUtf16(text, e)]);
    expectParity<Line>("shared_text", (r) => ({
      actual: {
        n: normalizeText(r.input),
        z: cleanZwnj(r.input),
        t: tokens(r.input, false),
        h: tokens(r.input, true),
        w: words(r.input),
        s: sentences(r.input),
        d: detectScript(r.input),
      },
      expected: {
        n: r.normalize_text,
        z: r.clean_zwnj,
        t: converted(r.input, r.tokens),
        h: converted(r.input, r.tokens_hyphen),
        w: r.words,
        s: r.sentences,
        d: r.script,
      },
    }));
  });

  it("distances", () => {
    interface Line {
      a: string;
      b: string;
      levenshtein: number;
      damerau: number;
      weighted: number;
    }
    expectParity<Line>("shared_distance", (r) => ({
      actual: [levenshtein(r.a, r.b), damerauLevenshtein(r.a, r.b), round(weightedDistance(r.a, r.b), 6)],
      expected: [r.levenshtein, r.damerau, r.weighted],
    }));
  });

  it("language identification", () => {
    interface Line {
      input: string;
      lang: string;
      script: string;
      confidence: number;
      scores: Record<string, number>;
    }
    const sorted = (scores: Record<string, number>) =>
      Object.entries(scores)
        .map(([k, v]) => [k, round(v, 6)])
        .sort();
    expectParity<Line>("shared_lid", (r) => {
      const result = identify(r.input);
      return {
        actual: [
          result.lang,
          result.script,
          result.confidence,
          sorted(result.scores as Record<string, number>),
        ],
        expected: [r.lang, r.script, r.confidence, sorted(r.scores)],
      };
    });
  });

  it("the script of every character of the basic plane", () => {
    interface Line {
      from: number;
      to: number;
      script: string;
    }
    expectParity<Line>("shared_char_script", (r) => {
      const wrong: string[] = [];
      for (let code = r.from; code <= r.to; code++) {
        if (code >= 0xd800 && code <= 0xdfff) continue; // lone surrogates cannot occur in valid text
        const found = charScript(String.fromCodePoint(code));
        if (found !== r.script) wrong.push(`U+${code.toString(16)} ${found}`);
      }
      return { actual: wrong, expected: [] };
    });
  });

  it("clusters", () => {
    interface Line {
      cluster: string[];
      onset_initial: boolean;
      onset_medial: boolean;
      coda_final: boolean;
      coda_medial: boolean;
      sonority: number[];
    }
    expectParity<Line>("shared_phonology_clusters", (r) => ({
      actual: [
        legalOnset(r.cluster, true),
        legalOnset(r.cluster, false),
        legalCoda(r.cluster, true),
        legalCoda(r.cluster, false),
        r.cluster.map(sonority),
      ],
      expected: [r.onset_initial, r.onset_medial, r.coda_final, r.coda_medial, r.sonority],
    }));
  });

  it("epenthesis and syllables", () => {
    interface Line {
      segments: Segment[];
      repaired: Segment[];
      syllables: Segment[][];
    }
    expectParity<Line>("shared_phonology_words", (r) => {
      const repaired = breakClusters(r.segments);
      return { actual: [repaired, syllabify(repaired)], expected: [r.repaired, r.syllables] };
    });
  });
});
