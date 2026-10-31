import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildLexicon, frequencyBucket, type LexiconInput } from "../src/builder.js";
import { InvalidFsaError, InvalidLexiconError, Lexicon, loadLexicon } from "../src/index.js";
import { lexiconPath, loadLexiconFile, readFixture } from "../src/node.js";

const input: LexiconInput = {
  lang: "kmr",
  zimankit: "9.9.9",
  data: "2026.1.1",
  forms: [
    {
      word: "jinê",
      lemma: "jin",
      upos: "NOUN",
      features: '{"case":"obl","gender":"f"}',
      attested: true,
      zipf: 4.5,
      quality: "gold",
    },
    { word: "jin", lemma: "jin", upos: "NOUN", features: "{}", attested: true, zipf: 5.2, quality: "silver" },
    {
      word: "dît",
      lemma: "dîtin",
      upos: "VERB",
      features: '{"tense":"past"}',
      attested: false,
      zipf: 0,
      quality: "bronze",
    },
    { word: "jinan", lemma: "jin", upos: "NOUN", features: "{}", attested: true, zipf: 3, quality: "gold" },
  ],
  lemmas: [
    { lemma: "jin", upos: "NOUN", gender: "f", zipf: 5.5 },
    {
      lemma: "dîtin",
      upos: "VERB",
      transitivity: "transitive",
      present: "bîn",
      past: "dît",
      variantOf: "dîtin",
      seeAlso: "dît",
      zipf: 4,
    },
  ],
  variants: [{ variant: "jîn", standard: "jin" }],
};

const bytes = () => buildLexicon(input);

describe("Lexicon", () => {
  const lexicon = new Lexicon(bytes());

  it("reads versions and counts", () => {
    expect(lexicon.lang).toBe("kmr");
    expect(lexicon.zimankitVersion).toBe("9.9.9");
    expect(lexicon.dataVersion).toBe("2026.1.1");
    expect([lexicon.formCount, lexicon.lemmaCount]).toEqual([4, 2]);
  });

  it("finds a form with all it knows", () => {
    expect(lexicon.form("jinê")).toEqual({
      word: "jinê",
      lemma: "jin",
      upos: "NOUN",
      features: { case: "obl", gender: "f" },
      frequency: 18,
      quality: "gold",
      attested: true,
    });
    expect(lexicon.form("dît")).toMatchObject({
      lemma: "dîtin",
      attested: false,
      quality: "bronze",
      frequency: 0,
    });
    expect(lexicon.form("tune")).toBeNull();
    expect(lexicon.has("jin")).toBe(true);
    expect(lexicon.has("tune")).toBe(false);
  });

  it("finds a lemma with its stems", () => {
    expect(lexicon.lemma("jin")).toEqual({ lemma: "jin", upos: "NOUN", gender: "f", frequency: 22 });
    expect(lexicon.lemma("dîtin")).toEqual({
      lemma: "dîtin",
      upos: "VERB",
      transitivity: "transitive",
      present: "bîn",
      past: "dît",
      variantOf: "dîtin",
      seeAlso: "dît",
      frequency: 16,
    });
    expect(lexicon.lemma("tune")).toBeNull();
  });

  it("maps a non-standard spelling to the standard one", () => {
    expect(lexicon.standardSpelling("jîn")).toBe("jin");
    expect(lexicon.standardSpelling("jin")).toBeNull();
  });

  it("reads ranks without building entries, for ranking candidates", () => {
    const rank = lexicon.automaton.rank("jin");
    expect(lexicon.frequencyAt(rank)).toBe(21);
    expect(lexicon.attestedAt(rank)).toBe(true);
    expect(lexicon.attestedAt(lexicon.automaton.rank("dît"))).toBe(false);
    expect(lexicon.formAt(rank).word).toBe("jin");
  });
});

describe("buildLexicon", () => {
  it("gives the same bytes whatever the order of its input", () => {
    const shuffled = { ...input, forms: [...input.forms].reverse(), lemmas: [...input.lemmas].reverse() };
    expect(buildLexicon(shuffled)).toEqual(bytes());
  });

  it("refuses a form with an unknown lemma", () => {
    const forms = [{ ...(input.forms[0] as LexiconInput["forms"][number]), lemma: "tune" }];
    expect(() => buildLexicon({ ...input, forms })).toThrow("unknown lemma");
  });

  it("refuses a variant of an unknown form", () => {
    const variants = [{ variant: "a", standard: "tune" }];
    expect(() => buildLexicon({ ...input, variants })).toThrow("unknown form");
  });

  it("buckets frequencies into five bits", () => {
    expect([frequencyBucket(-1), frequencyBucket(0), frequencyBucket(2.5), frequencyBucket(99)]).toEqual([
      0, 0, 10, 31,
    ]);
  });
});

describe("a damaged file is refused on load", () => {
  /** Rewrite the JSON header of a valid file, keeping sections where they are. */
  const withHeader = (edit: (header: Record<string, unknown>) => unknown): Uint8Array => {
    const good = bytes();
    const view = new DataView(good.buffer);
    const length = view.getUint32(8, true);
    const header = JSON.parse(new TextDecoder().decode(good.subarray(12, 12 + length)));
    const encoded = new TextEncoder().encode(JSON.stringify(edit(header)));
    if (encoded.length > length) throw new Error("the edit must not grow the header");
    const edited = new Uint8Array(length).fill(0x20); // spaces are valid after JSON
    edited.set(encoded);
    const out = good.slice();
    out.set(edited, 12);
    return out;
  };
  /** Overwrite part of a section with one byte value. */
  const corrupt = (name: string, value: number): Uint8Array => {
    const good = bytes();
    const view = new DataView(good.buffer);
    const header = JSON.parse(new TextDecoder().decode(good.subarray(12, 12 + view.getUint32(8, true))));
    const { offset, length } = header.sections[name];
    good.fill(value, offset, offset + length);
    return good;
  };

  it.each<[string, () => Uint8Array, string]>([
    ["too short", () => new Uint8Array(4), "too short"],
    ["wrong magic number", () => new Uint8Array(32), "not a Zimanyar lexicon"],
    [
      "newer format",
      () => {
        const out = bytes();
        new DataView(out.buffer).setUint32(4, 99, true);
        return out;
      },
      "unsupported format",
    ],
    [
      "header past the end",
      () => {
        const out = bytes();
        new DataView(out.buffer).setUint32(8, 0xffffffff, true);
        return out;
      },
      "out of bounds",
    ],
    [
      "header that is not JSON",
      () => {
        const out = bytes();
        out.fill(0xff, 12, 40);
        return out;
      },
      "header is not valid",
    ],
    ["header that is not an object", () => withHeader(() => 1), "header is not valid"],
    ["unknown language", () => withHeader((h) => ({ ...h, lang: "xx" })), "unknown language"],
    ["missing tables", () => withHeader((h) => ({ ...h, featureSets: 1 })), "header is not valid"],
    [
      "section past the end",
      () =>
        withHeader((h) => ({
          ...h,
          lemmaDetails: {},
          sections: { ...(h["sections"] as object), formMeta: { offset: 1e9, length: 4 } },
        })),
      "out of bounds",
    ],
    [
      "negative offset",
      () =>
        withHeader((h) => ({
          ...h,
          sections: { ...(h["sections"] as object), formMeta: { offset: -4, length: 4 } },
        })),
      "out of bounds",
    ],
    [
      "misaligned section",
      () =>
        withHeader((h) => ({
          ...h,
          sections: { ...(h["sections"] as object), formArcs: { offset: 12, length: 5 } },
        })),
      "out of bounds",
    ],
    [
      "missing section",
      () =>
        withHeader((h) => {
          const sections = { ...(h["sections"] as Record<string, unknown>) };
          delete sections["formMeta"];
          return { ...h, sections };
        }),
      "out of bounds",
    ],
    [
      "column of the wrong length",
      () =>
        withHeader((h) => {
          const sections = h["sections"] as Record<string, { offset: number; length: number }>;
          return {
            ...h,
            sections: { ...sections, formMeta: { offset: sections["formMeta"]?.offset, length: 1 } },
          };
        }),
      "wrong length",
    ],
    ["lemma index outside its table", () => corrupt("formLemma", 0xff), "points outside"],
    ["feature index outside its table", () => corrupt("formFeatures", 0xff), "points outside"],
    ["attribute index outside its table", () => corrupt("lemmaAttributes", 0xff), "points outside"],
    ["variant target outside its table", () => corrupt("variantTargets", 0xff), "points outside"],
  ])("%s", (_name, make, message) => {
    expect(() => new Lexicon(make())).toThrow(InvalidLexiconError);
    expect(() => new Lexicon(make())).toThrow(message);
  });

  it("damaged arcs", () => {
    expect(() => new Lexicon(corrupt("formArcs", 0xff))).toThrow(InvalidFsaError);
  });
});

describe("loading", () => {
  it("reads plain and gzipped files", async () => {
    expect((await loadLexicon(bytes())).formCount).toBe(4);
    expect((await loadLexicon(gzipSync(bytes()))).formCount).toBe(4);
  });

  it("does not need its bytes aligned", async () => {
    const shifted = new Uint8Array(bytes().length + 1);
    shifted.set(bytes(), 1);
    expect((await loadLexicon(shifted.subarray(1))).formCount).toBe(4);
  });

  it("refuses a damaged gzip stream", async () => {
    await expect(loadLexicon(gzipSync(bytes()).subarray(0, 40))).rejects.toThrow();
  });

  it("loads a compiled file from disk", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zimanyar-data-"));
    writeFileSync(lexiconPath("kmr", directory), gzipSync(bytes()));
    expect((await loadLexiconFile("kmr", directory)).form("jin")?.lemma).toBe("jin");
    expect(lexiconPath("ckb")).toMatch(/build\/lexicon-ckb\.bin\.gz$/);
  });
});

describe("fixtures", () => {
  it("prefers the full set and falls back to the committed sample", () => {
    const root = mkdtempSync(join(tmpdir(), "zimanyar-fixtures-"));
    const build = join(root, "build");
    mkdirSync(join(root, "fixtures"), { recursive: true });
    mkdirSync(join(build, "fixtures"), { recursive: true });
    writeFileSync(join(root, "fixtures", "a.jsonl"), '{"from":"sample"}\n');
    expect(readFixture("a", build)).toEqual([{ from: "sample" }]);
    writeFileSync(join(build, "fixtures", "a.jsonl"), '{"from":"full"}\n{"from":"full"}\n');
    expect(readFixture("a", build)).toEqual([{ from: "full" }, { from: "full" }]);
  });
});
