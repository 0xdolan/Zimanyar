import { existsSync } from "node:fs";
import { Lexicon } from "@zimanyar/data";
import { buildLexicon, type LexiconInput } from "@zimanyar/data/builder";
import { hasFullFixture, lexiconPath, loadLexiconFile } from "@zimanyar/data/node";
import { describe, expect, it } from "vitest";
import { analyze, ckb, complete, kmr, lexiconAdapter, normalize, suggest, toIpa } from "../src/index.js";
import { round } from "../src/python.js";
import type { Analysis } from "../src/schema.js";
import { expectParity } from "./parity-helpers.js";

const form = (
  word: string,
  lemma: string,
  zipf = 3,
  attested = true,
  upos = "NOUN",
  quality: "gold" | "silver" | "bronze" = "gold",
) => ({
  word,
  lemma,
  upos,
  features: "{}",
  attested,
  zipf,
  quality,
});

const kurmanji: LexiconInput = {
  lang: "kmr",
  zimankit: "t",
  data: "t",
  forms: [
    form("kitêb", "kitêb", 5),
    form("kitêba", "kitêb", 4.5),
    form("kitêbê", "kitêb", 4.75),
    form("kitêbek", "kitêb", 4),
    form("kitêbên", "kitêb", 1, false),
    form("kitêbxane", "kitêbxane", 3),
    form("mal", "mal", 5),
    form("malê", "mal", 4),
    form("malek", "mal", 3, true, "NOUN", "silver"),
    form("male", "mal", 3, true, "NOUN", "gold"),
    form("xanî", "xanî", 4),
    form("xaniyê", "xanî", 3.5),
    form("şev", "şev", 4),
    form("dîtin", "dîtin", 4.5, true, "VERB"),
    form("dîtî", "dîtin", 4, true, "VERB"),
    form("baş", "baş", 5, true, "ADJ"),
    form("başî", "başî", 2),
  ],
  lemmas: [
    { lemma: "kitêb", upos: "NOUN", gender: "f", zipf: 5, count: 900 },
    { lemma: "kitêbxane", upos: "NOUN", gender: "f", zipf: 3, count: 50 },
    { lemma: "mal", upos: "NOUN", gender: "f", zipf: 5, count: 800 },
    { lemma: "xanî", upos: "NOUN", gender: "m", zipf: 4, count: 300 },
    { lemma: "şev", upos: "NOUN", gender: "f", zipf: 4, count: 300 },
    {
      lemma: "dîtin",
      upos: "VERB",
      transitivity: "transitive",
      present: "bîn",
      past: "dît",
      zipf: 4.5,
      count: 500,
    },
    { lemma: "baş", upos: "ADJ", zipf: 5, count: 700 },
    { lemma: "başî", upos: "NOUN", gender: "f", zipf: 2, count: 10 },
  ],
  variants: [],
};
const sorani: LexiconInput = {
  lang: "ckb",
  zimankit: "t",
  data: "t",
  forms: [
    form("بەڵام", "بەڵام", 6),
    form("گوڵ", "گوڵ", 4),
    form("گوڵەکە", "گوڵ", 3.5),
    form("گول", "گول", 1),
    form("پیاو", "پیاو", 5),
    form("پیاوەکە", "پیاو", 4),
    form("کردن", "کردن", 5, true, "VERB"),
    form("کتێب", "کتێب", 5),
  ],
  lemmas: [
    { lemma: "بەڵام", upos: "CCONJ", zipf: 6, count: 9000 },
    { lemma: "گوڵ", upos: "NOUN", zipf: 4, count: 300 },
    { lemma: "گول", upos: "NOUN", zipf: 1, count: 2 },
    { lemma: "پیاو", upos: "NOUN", zipf: 5, count: 800 },
    {
      lemma: "کردن",
      upos: "VERB",
      transitivity: "transitive",
      present: "کە",
      past: "کرد",
      zipf: 5,
      count: 800,
    },
    { lemma: "کتێب", upos: "NOUN", zipf: 5, count: 800 },
  ],
  variants: [{ variant: "بەلام", standard: "بەڵام" }],
};
const kmrLexicon = new Lexicon(buildLexicon(kurmanji));
const ckbLexicon = new Lexicon(buildLexicon(sorani));
const words = (items: readonly { word: string }[]) => items.map((item) => item.word);

describe("lexiconAdapter", () => {
  const adapter = lexiconAdapter(kmrLexicon);

  it("answers about lemmas, not forms", () => {
    expect(adapter.has("mal")).toBe(true);
    expect(adapter.has("malê")).toBe(false);
    expect(adapter.freq("mal")).toBe(800);
    expect(adapter.freq("tune")).toBe(0);
    expect(adapter.genderOf("xanî")).toBe("m");
    expect(adapter.genderOf("baş")).toBeNull();
    expect(adapter.genderOf("tune")).toBeNull();
    expect([...adapter.posOf("dîtin")]).toEqual(["VERB"]);
    expect([...adapter.posOf("tune")]).toEqual([]);
    expect(adapter.posOf("mal")).toBe(adapter.posOf("kitêb"));
  });

  it("gives the analyzer gender from the file", () => {
    const analyzer = new kmr.KmrAnalyzer(adapter);
    expect(analyzer.best("malê")?.features).toMatchObject({ case: "obl", gender: "f" });
  });
});

describe("suggest", () => {
  it("offers the learned standard spelling first", () => {
    expect(suggest("بەلام", ckbLexicon)[0]).toEqual({ word: "بەڵام", cost: 0, source: "variant" });
  });

  it("prices confusable letters below other edits", () => {
    const [first] = suggest("şêv", kmrLexicon, { maxCost: 1 });
    expect(first).toMatchObject({ word: "şev", cost: 0.3 });
    expect(suggest("sev", kmrLexicon)[0]).toMatchObject({ word: "şev", cost: 0.3 });
  });

  it("finds insertions, deletions, substitutions and transpositions", () => {
    expect(words(suggest("mla", kmrLexicon, { maxCost: 1 }))).toContain("mal");
    expect(words(suggest("kitêbb", kmrLexicon, { maxCost: 1 }))).toContain("kitêb");
    expect(words(suggest("kitb", kmrLexicon, { maxCost: 1 }))).not.toContain("kitêba");
    expect(words(suggest("kitêv", kmrLexicon, { maxCost: 1 }))).toContain("kitêb");
  });

  it("does not suggest the word itself or go past its limit", () => {
    expect(words(suggest("mal", kmrLexicon))).not.toContain("mal");
    expect(suggest("zzzzzzzz", kmrLexicon)).toEqual([]);
    expect(suggest("", kmrLexicon)).toEqual([]);
    expect(suggest("kitêv", kmrLexicon, { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it("ranks by cost, then frequency, then quality, then spelling", () => {
    // mal costs one edit from mall; the rest cost more.
    expect(suggest("mall", kmrLexicon, { maxCost: 2 })[0]).toMatchObject({ word: "mal", cost: 1 });
    // male and malek cost the same from malez and are equally frequent; male has the better quality.
    const tied = words(suggest("malez", kmrLexicon, { maxCost: 1 }));
    expect(tied.indexOf("male")).toBeGreaterThanOrEqual(0);
    expect(tied.indexOf("male")).toBeLessThan(tied.indexOf("malek"));
    // malê is more frequent than male, at the same cost from malq.
    const frequent = words(suggest("malq", kmrLexicon, { maxCost: 1 }));
    expect(frequent.indexOf("mal")).toBeLessThan(frequent.indexOf("male"));
    expect(frequent.indexOf("malê")).toBeLessThan(frequent.indexOf("male"));
  });

  it("uses the Sorani letter toggles", () => {
    expect(suggest("گوڵ", ckbLexicon).map((s) => s.word)).toContain("گول");
    expect(words(suggest("کوتێب", ckbLexicon))).toContain("کتێب");
  });

  it("lets a misspelt stem keep its ending", () => {
    const fixes = suggest("پیاویەکە", ckbLexicon);
    expect(words(fixes)).toContain("پیاوەکە");
    const stem = suggest("xxmalê", kmrLexicon, { maxCost: 2 });
    expect(words(stem)).toContain("malê");
  });
});

describe("complete", () => {
  it("offers words by frequency, and the plan's example", () => {
    expect(words(complete("kit", kmrLexicon)).slice(0, 4)).toEqual(["kitêb", "kitêbê", "kitêba", "kitêbek"]);
  });

  it("never ranks a form never seen above one that was", () => {
    const list = complete("kit", kmrLexicon);
    const firstUnseen = list.findIndex((c) => !c.attested);
    expect(firstUnseen).toBeGreaterThan(0);
    expect(list.slice(firstUnseen).every((c) => !c.attested)).toBe(true);
  });

  it("does not offer the prefix itself, and respects its limit", () => {
    expect(words(complete("mal", kmrLexicon))).not.toContain("mal");
    expect(complete("kit", kmrLexicon, { limit: 2 })).toHaveLength(2);
    expect(complete("", kmrLexicon)).toEqual([]);
    expect(complete("zz", kmrLexicon)).toEqual([]);
  });

  it("adds a noun's forms that the lexicon lacks, ranked below those it has", () => {
    const list = complete("şev", kmrLexicon, { limit: 20 });
    expect(words(list)).toContain("şevê");
    expect(list.find((c) => c.word === "şevê")).toEqual({ word: "şevê", frequency: 0, attested: false });
    expect(complete("şev", kmrLexicon, { includeInflections: false })).toEqual([]);
    expect(words(complete("پیاو", ckbLexicon, { limit: 30 }))).toContain("پیاوەکان");
  });

  it("uses a masculine noun's own forms", () => {
    const list = words(complete("şev", kmrLexicon, { limit: 20 }));
    expect(list).not.toContain("şevî");
    const lexicon = new Lexicon(
      buildLexicon({
        ...kurmanji,
        forms: [form("gund", "gund", 4)],
        lemmas: [{ lemma: "gund", upos: "NOUN", gender: "m", zipf: 4 }],
      }),
    );
    expect(words(complete("gund", lexicon, { limit: 20 }))).toContain("gundî");
  });

  it("offers only what extends the prefix", () => {
    // Every form of xanî with an ending shortens the stem (xaniyê), so none can complete it.
    expect(complete("xanî", kmrLexicon, { limit: 20 })).toEqual([]);
    expect(words(complete("xan", kmrLexicon, { limit: 20 }))).toEqual(["xanî", "xaniyê"]);
  });

  it("adds a verb's forms that start with the prefix", () => {
    expect(words(complete("dîtin", kmrLexicon, { limit: 50 }))).toContain("dîtine");
    expect(complete("dîtin", kmrLexicon, { includeInflections: false })).toEqual([]);
    // No form of کردن extends the infinitive itself.
    expect(complete("کردن", ckbLexicon, { limit: 50 })).toEqual([]);
  });

  it("gives up quietly when a verb cannot be built", () => {
    const lexicon = new Lexicon(
      buildLexicon({
        ...kurmanji,
        forms: [form("xx", "xx", 3, true, "VERB")],
        lemmas: [{ lemma: "xx", upos: "VERB", zipf: 3 }],
      }),
    );
    expect(complete("xx", lexicon)).toEqual([]);
    const sorani2 = new Lexicon(
      buildLexicon({
        ...sorani,
        forms: [form("زز", "زز", 3, true, "VERB")],
        lemmas: [{ lemma: "زز", upos: "VERB", zipf: 3 }],
        variants: [],
      }),
    );
    expect(complete("زز", sorani2)).toEqual([]);
  });

  it("offers nothing extra for other parts of speech", () => {
    expect(words(complete("baş", kmrLexicon))).toEqual(["başî"]);
  });
});

describe("the top-level API", () => {
  it("chooses the variety by script, or as told", () => {
    expect(normalize("كتێب")).toBe("کتێب");
    expect(normalize("dıçım")).toBe("diçim");
    expect(normalize("كتێب", "kmr")).toBe("كتێب");
    expect(toIpa("چای")).toBe("tʃaːj");
    expect(toIpa("xwe")).toBe("xʷɛ");
    expect(toIpa("xwe", "kmr")).toBe("xʷɛ");
    expect(analyze("دەکەم")[0]?.lemma).toBe("کردن");
    expect(analyze("têm")[0]?.lemma).toBe("hatin");
    expect(analyze("têm", "kmr")[0]?.lemma).toBe("hatin");
  });
});

const haveLexicons = existsSync(lexiconPath("ckb")) && existsSync(lexiconPath("kmr"));

/** The real proof: the analyzers give zimankit's answers when reading the compiled file itself. */
describe.skipIf(!haveLexicons || !hasFullFixture("ckb_analyze"))("the compiled lexicon", () => {
  interface AnalyzeLine {
    input: string;
    readings: Analysis[];
  }
  const top = (analyzer: { analyze(word: string): Analysis[] }, word: string) =>
    analyzer
      .analyze(word)
      .slice(0, 3)
      .map((reading) => ({ ...reading, score: round(reading.score, 6) }));

  it("gives zimankit's Sorani readings", async () => {
    const analyzer = new ckb.CkbAnalyzer(lexiconAdapter(await loadLexiconFile("ckb")));
    expectParity<AnalyzeLine>("ckb_analyze", (r) => ({
      actual: top(analyzer, r.input),
      expected: r.readings,
    }));
  });

  it("gives zimankit's Kurmanji readings and ergativity", async () => {
    const analyzer = new kmr.KmrAnalyzer(lexiconAdapter(await loadLexiconFile("kmr")));
    expectParity<AnalyzeLine>("kmr_analyze", (r) => ({
      actual: top(analyzer, r.input),
      expected: r.readings,
    }));
    interface Line {
      sentence: string;
      agreement_ok: boolean | null;
      verb: string | null;
    }
    expectParity<Line>("kmr_alignment", (r) => {
      const record = kmr.detectAlignment(r.sentence, analyzer);
      return { actual: [record.verb, record.agreementOk], expected: [r.verb, r.agreement_ok] };
    });
  });

  it("suggests and completes real words", async () => {
    const sorani = await loadLexiconFile("ckb");
    const kurmanji = await loadLexiconFile("kmr");
    expect(suggest("بەلام", sorani)[0]?.word).toBe("بەڵام");
    expect(words(suggest("kitab", kurmanji))).toContain("kitêb");
    expect(words(complete("kit", kurmanji))).toContain("kitêb");
    expect(words(complete("پیا", sorani))).toContain("پیاو");
  });
});
