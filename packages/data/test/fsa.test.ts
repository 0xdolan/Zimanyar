import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { encodeArc, Fsa, InvalidFsaError } from "../src/fsa.js";
import { buildFsa } from "../src/fsa-builder.js";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (words: string[]) => [...new Set(words)].filter(Boolean).sort(compare);
const alphabet = fc.constantFrom(..."abçêîşûکڕڵێۆەی‌");
const word = fc.string({ unit: alphabet, minLength: 1, maxLength: 12 });
const wordLists = fc.array(word, { maxLength: 200 }).map(sortedUnique);

describe("buildFsa", () => {
  it("stores exactly the words it was given", () => {
    fc.assert(
      fc.property(wordLists, word, (words, other) => {
        const fsa = buildFsa(words);
        expect(fsa.wordCount).toBe(words.length);
        for (const w of words) expect(fsa.has(w)).toBe(true);
        expect(fsa.has(other)).toBe(words.includes(other));
      }),
      { numRuns: 1000 },
    );
  });

  it("gives each word its sorted position as its rank, and back", () => {
    fc.assert(
      fc.property(wordLists, (words) => {
        const fsa = buildFsa(words);
        words.forEach((w, i) => {
          expect(fsa.rank(w)).toBe(i);
          expect(fsa.wordAt(i)).toBe(w);
        });
      }),
      { numRuns: 1000 },
    );
  });

  it("lists words by prefix in order with their ranks", () => {
    fc.assert(
      fc.property(wordLists, fc.string({ unit: alphabet, maxLength: 3 }), (words, prefix) => {
        const fsa = buildFsa(words);
        const expected = words.filter((w) => w.startsWith(prefix));
        const found = [...fsa.withPrefix(prefix)];
        expect(found.map((f) => f.word)).toEqual(expected);
        for (const f of found) expect(f.rank).toBe(words.indexOf(f.word));
      }),
      { numRuns: 1000 },
    );
  });

  it("merges shared suffixes into one automaton", () => {
    const stems = ["kitêb", "pirtûk", "mal", "jin", "gund", "bajar", "zarok", "welat"];
    const endings = ["", "a", "ê", "ek", "ekê", "ekî", "an", "ên"];
    const words = stems.flatMap((s) => endings.map((e) => s + e)).sort(compare);
    const { arcs } = buildFsa(words).tables;
    const characters = words.reduce((sum, w) => sum + w.length, 0);
    expect(arcs.length).toBeLessThan(characters / 3);
  });

  it("allows one word to be the prefix of another", () => {
    const fsa = buildFsa(["a", "ab", "abc"]);
    expect([fsa.rank("a"), fsa.rank("ab"), fsa.rank("abc")]).toEqual([0, 1, 2]);
  });

  it("handles an empty list", () => {
    const fsa = buildFsa([]);
    expect(fsa.wordCount).toBe(0);
    expect(fsa.has("a")).toBe(false);
    expect([...fsa.withPrefix("")]).toEqual([]);
    expect(() => fsa.wordAt(0)).toThrow(RangeError);
  });

  it("refuses words that are unsorted, repeated or empty", () => {
    expect(() => buildFsa(["b", "a"])).toThrow("sorted");
    expect(() => buildFsa(["a", "a"])).toThrow("sorted");
    expect(() => buildFsa([""])).toThrow("empty");
  });

  it("refuses an alphabet the format cannot hold", () => {
    const words = Array.from({ length: 300 }, (_, i) => String.fromCharCode(0x4e00 + i));
    expect(() => buildFsa(words)).toThrow("alphabet");
  });
});

describe("Fsa", () => {
  const fsa = buildFsa(["ba", "bab", "bav", "dê"]);

  it("does not find partial words, longer words or foreign letters", () => {
    for (const miss of ["", "b", "babb", "bavê", "x", "dế"]) {
      expect(fsa.rank(miss)).toBe(-1);
    }
  });

  it("rejects ranks that do not exist", () => {
    for (const rank of [-1, 4, 1.5, Number.NaN]) expect(() => fsa.wordAt(rank)).toThrow(RangeError);
  });

  it("walks arcs from the start state", () => {
    const seen: [string, boolean][] = [];
    fsa.forEachArc(fsa.start, (unit, final) => seen.push([String.fromCharCode(unit), final]));
    expect(seen).toEqual([
      ["b", false],
      ["d", false],
    ]);
    fsa.forEachArc(0, () => expect.unreachable());
  });

  it("completes a prefix that is itself a word, and an empty prefix", () => {
    expect([...fsa.withPrefix("ba")].map((f) => f.word)).toEqual(["ba", "bab", "bav"]);
    expect([...fsa.withPrefix("")].map((f) => f.word)).toEqual(["ba", "bab", "bav", "dê"]);
    expect([...fsa.withPrefix("q")]).toEqual([]);
    expect([...fsa.withPrefix("bx")]).toEqual([]);
    expect([...fsa.withPrefix("dêx")]).toEqual([]);
  });

  describe("refuses a damaged automaton", () => {
    const alphabetOf = Uint16Array.from([97, 98]);
    const sentinel = 0;
    it.each([
      ["no arcs", []],
      ["label outside the alphabet", [sentinel, encodeArc(9, true, true, 0)]],
      ["labels out of order", [sentinel, encodeArc(1, false, true, 0), encodeArc(0, true, true, 0)]],
      ["a target that is not earlier", [sentinel, encodeArc(0, true, true, 1)]],
      ["a target past the end", [sentinel, encodeArc(0, true, true, 99)]],
      ["an unclosed node", [sentinel, encodeArc(0, false, true, 0)]],
    ])("%s", (_name, arcs) => {
      expect(() => new Fsa(Uint32Array.from(arcs), alphabetOf)).toThrow(InvalidFsaError);
    });

    it("an alphabet that is too large", () => {
      expect(() => new Fsa(Uint32Array.from([0]), new Uint16Array(256))).toThrow(InvalidFsaError);
    });
  });
});
