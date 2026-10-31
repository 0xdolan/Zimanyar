import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ckb,
  identify,
  isLang,
  kmr,
  normalizeText,
  PATTERNS,
  type PatternName,
  pattern,
  tokenize,
  words,
} from "../src/index.js";
import { count, isSpace, pythonRegex, round, strip, translate, untilStable } from "../src/python.js";

describe("Python semantics", () => {
  it("rounds like Python, with true ties to the even digit", () => {
    expect([round(0.125, 2), round(0.375, 2), round(2.5, 0), round(3.5, 0)]).toEqual([0.12, 0.38, 2, 4]);
    // Not a true tie in binary, so not treated as one.
    expect(round(1.0005, 3)).toBe(1);
    expect(round(0.1234567, 6)).toBe(0.123457);
    expect(round(1, 3)).toBe(1);
  });

  it("counts what Python counts as a space", () => {
    for (const space of [" ", "\t", "\u00a0", "\u0085", "\u001c", "\u2003", "\u3000"]) {
      expect(isSpace(space)).toBe(true);
    }
    for (const other of ["\ufeff", "a", "\u200c", "\u200b"]) expect(isSpace(other)).toBe(false);
    expect(strip("\u0085 a b\u3000\n")).toBe("a b");
    expect(strip("\ufeffa")).toBe("\ufeffa");
  });

  it("counts without overlaps", () => {
    expect([count("aaaa", "aa"), count("abc", "x"), count("", "a")]).toEqual([2, 0, 0]);
  });

  it("translates and drops characters", () => {
    expect(
      translate(
        "a\u{1f600}b",
        new Map([
          ["a", "x"],
          ["\u{1f600}", ""],
        ]),
      ),
    ).toBe("xb");
  });

  describe("pythonRegex", () => {
    it("treats \\w as letters and numbers, without combining marks", () => {
      expect(pythonRegex("^\\w+$").test("a\u0661_")).toBe(true);
      expect(pythonRegex("^\\w+$").test("a\u0301")).toBe(false);
      expect(pythonRegex("\\W").test("a\u0301")).toBe(true);
    });

    it("treats \\s as Python does, also inside a class", () => {
      expect(pythonRegex("^\\s$").test("\ufeff")).toBe(false);
      expect(pythonRegex("^\\S$").test("\ufeff")).toBe(true);
      expect(pythonRegex("^[\\s]$").test("\u0085")).toBe(true);
      expect(pythonRegex("^[\\w-]+$").test("a-b")).toBe(true);
    });

    it("translates the horizontal space class", () => {
      const pattern = pythonRegex("[^\\S\\r\\n]+", "g");
      expect("a \t\u00a0b\nc\rd".replace(pattern, "_")).toBe("a_b\nc\rd");
    });

    it("renames named groups, and leaves other escapes alone", () => {
      expect(pythonRegex("(?P<x>a)\\.").exec("a.")?.groups?.["x"]).toBe("a");
      expect(pythonRegex("[(?P<]").test("<")).toBe(true);
    });

    it("matches Python's end of text and dot", () => {
      expect(pythonRegex("^a$").test("a\n")).toBe(true);
      expect(pythonRegex("^a$").test("a\n\n")).toBe(false);
      expect(pythonRegex("^.$").test("\r")).toBe(true);
      expect(pythonRegex("^.$").test("\n")).toBe(false);
      expect(pythonRegex("^[.$]$").test("$")).toBe(true);
      expect(pythonRegex("^\\.$").test("a")).toBe(false);
    });

    it("refuses a class it cannot translate", () => {
      expect(() => pythonRegex("[\\Sa]")).toThrow("cannot be translated");
      expect(() => pythonRegex("[\\Wa]")).toThrow("cannot be translated");
    });
  });
});

describe("the regex cookbook", () => {
  it("compiles every pattern", () => {
    for (const name of Object.keys(PATTERNS) as PatternName[]) expect(pattern(name)).toBeInstanceOf(RegExp);
  });

  it("finds what the names say", () => {
    expect(pattern("kmr_direct_pronoun").test("ez")).toBe(true);
    expect(pattern("kmr_turkish_letters").test("d\u0131\u00e7\u0131m")).toBe(true);
    expect(pattern("kmr_word").test("kit\u00eab")).toBe(true);
    expect(pattern("kmr_word").test("kit\u00eab1")).toBe(false);
  });
});

describe("properties", () => {
  const text = fc.string({
    unit: fc.constantFrom(
      ..."ab \n\t.,'-\u200c\u200d\u200e\u00a0\u0628\u0627\u06a9\u0631\u0647\u06d51\u0661@#",
    ),
    maxLength: 60,
  });
  const messyText = fc
    .array(
      fc.constantFrom(
        ..."ab \n\t.,'\u2019-\u200c\u200d\u200e\u00a0\u0628\u0627\u06a9\u0631\u0647\u06d5\u0648\u06cc\u0643\u064a\u0629\u0626\u0654\u064e1\u0661@#?I\u0130\u0131\u015e\u00eae\u0302\u00e9\ufb50/:".split(
          "",
        ),
        "\u{1f600}",
        "https://x",
        "www.y",
        "a@b.c",
      ),
      { maxLength: 30 },
    )
    .map((parts) => parts.join(""));

  it.each<[string, (text: string) => string]>([
    ["normalizeText", (t) => normalizeText(t)],
    ["ckb.normalize", (t) => ckb.normalize(t)],
    ["ckb.normalizeWord", ckb.normalizeWord],
    ["kmr.normalize", (t) => kmr.normalize(t)],
    ["kmr.normalizeWord", (t) => kmr.normalizeWord(t)],
  ])("%s is idempotent", (_name, normalizer) => {
    fc.assert(
      fc.property(messyText, (t) => {
        const once = normalizer(t);
        expect(normalizer(once)).toBe(once);
      }),
      { numRuns: 5000 },
    );
  });

  // Inputs where zimankit's one pass is not stable: recorded in docs/dev/parity-exceptions.md.
  it.each<[string, (text: string) => string, string, string]>([
    ["a stripped email strands a ZWNJ", (t) => normalizeText(t), "\u06a9\u200c\u0628@a.b", "\u06a9"],
    ["a removed ZWNJ lets two characters compose", (t) => normalizeText(t), "\u0627\u200c\u0654", "\u0623"],
    ["a dropped mark leaves a leading space", (t) => ckb.normalize(t), "\u064e a", "a"],
    ["a dropped apostrophe leaves a leading space", (t) => kmr.normalize(t), "\u2019\ta", "a"],
  ])("%s", (_name, normalizer, input, expected) => {
    expect(normalizer(input)).toBe(expected);
  });

  it("stops repeating even if a step never settles", () => {
    let calls = 0;
    expect(
      untilStable("a", (t) => {
        calls++;
        return `${t}a`;
      }).length,
    ).toBe(9);
    expect(calls).toBe(8);
  });

  it("tokens are in order, match their offsets, and cover everything but spaces", () => {
    fc.assert(
      fc.property(text, fc.boolean(), (t, keep) => {
        let position = 0;
        const covered = new Array<boolean>(t.length).fill(false);
        for (const token of tokenize(t, keep)) {
          expect(token.start).toBeGreaterThanOrEqual(position);
          expect(t.slice(token.start, token.end)).toBe(token.text);
          covered.fill(true, token.start, token.end);
          position = token.end;
        }
        covered.forEach((isCovered, i) => {
          if (!isCovered) expect(isSpace(t[i] as string)).toBe(true);
        });
      }),
      { numRuns: 1000 },
    );
  });

  it("word tokens are the words", () => {
    fc.assert(
      fc.property(text, (t) => {
        const fromTokens = tokenize(t)
          .filter((token) => token.kind === "word")
          .map((token) => token.text);
        expect(fromTokens).toEqual(words(t));
      }),
      { numRuns: 1000 },
    );
  });
});

describe("offsets are UTF-16", () => {
  it("counts a character outside the basic plane as two units", () => {
    expect(tokenize("\u{1f600} ab")).toEqual([
      { text: "\u{1f600}", kind: "punct", start: 0, end: 2 },
      { text: "ab", kind: "word", start: 3, end: 5 },
    ]);
  });
});

describe("identify", () => {
  it("gives the script's default for short text and und without a script", () => {
    expect(identify("kit\u00eab")).toMatchObject({ lang: "kmr", confidence: 0.1 });
    expect(identify("\u06a9\u062a\u06ce\u0628")).toMatchObject({ lang: "ckb", confidence: 0.1 });
    expect(identify("123")).toMatchObject({ lang: "und", script: "none" });
  });

  it("answers isLang from the language and its confidence", () => {
    const kurmanji = "Ez di mal\u00ea de me \u00fb ji bo w\u00ea dib\u00eaje ku ew li gund e";
    expect(isLang(kurmanji, "kmr")).toBe(true);
    expect(isLang(kurmanji, "ckb")).toBe(false);
    expect(isLang(kurmanji, "kmr", 1.1)).toBe(false);
  });
});
