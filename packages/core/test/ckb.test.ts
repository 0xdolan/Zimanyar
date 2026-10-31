import { describe, expect, it } from "vitest";
import { ckb, SimpleLexicon, segmentation } from "../src/index.js";

const {
  CkbAnalyzer,
  conjugate,
  decline,
  FormIndex,
  loadCoreVerbs,
  makeVerb,
  normalize,
  toIpa,
  validateWord,
} = ckb;

describe("orthography, from the rule catalogue", () => {
  it.each([
    ["كتێب", "کتێب"], // Arabic kaf
    ["رۆژ", "ڕۆژ"], // word-initial reh
    ["مەەر", "مەر"], // doubled ae
    ["به‌ڕێوه‌به‌ر", "بەڕێوەبەر"], // legacy heh
  ])("%s becomes %s", (wrong, right) => {
    expect(normalize(wrong)).toBe(right);
  });

  it("leaves digits and punctuation to its options", () => {
    expect(normalize("1?")).toBe("١؟");
    expect(normalize("1?", { digits: "keep", kurdishPunctuation: false })).toBe("1?");
  });

  it("is idempotent", () => {
    const text = "كتێب رۆژ به‌ڕێوه‌به‌ر";
    expect(normalize(normalize(text))).toBe(normalize(text));
  });

  it("names what is wrong with a word", () => {
    expect(validateWord("")).toEqual(["empty"]);
    expect(validateWord("کتێب")).toEqual([]);
    expect(validateWord("اسپ")).toContain("initial vowel without ئ");
    expect(validateWord("رۆژ")).toContain("initial ر should be ڕ");
    expect(validateWord("كت")[0]).toContain("non-Kurdish character(s): U+0643");
  });
});

describe("phonology", () => {
  it("decides و and ی from their neighbours", () => {
    expect(toIpa("و")).toBe("u"); // the conjunction
    expect(toIpa("چای")).toBe("tʃaːj"); // ی after a vowel is a glide
    expect(toIpa("میر")).toBe("miːɾ"); // ی between consonants is a vowel
  });

  it("marks the bizroke, the unwritten vowel", () => {
    expect(toIpa("برد")).toContain("(ɯ)");
    expect(ckb.syllables("برد").join("")).not.toContain("(");
  });

  it("renders a whole text, keeping punctuation", () => {
    expect(ckb.textToIpa("چای .")).toBe("tʃaːj .");
  });
});

describe("verbs", () => {
  const core = loadCoreVerbs();
  const known = new Map(core.map((verb) => [verb.infinitive, verb]));
  const forms = (infinitive: string) => conjugate(known.get(infinitive) as ckb.Verb).map((form) => form.form);

  it("agrees with the agent by a clitic in the past of a transitive verb", () => {
    expect(forms("کردن")).toContain("کردم");
    expect(forms("کردن")).toContain("نەمکرد");
  });

  it("keeps the irregular cells", () => {
    expect(forms("هاتن")).toContain("مەیە");
    expect(forms("هاتن")).toContain("وەرە");
  });

  it("gives ویستن clitic subjects, no imperative and no passive", () => {
    const features = conjugate(known.get("ویستن") as ckb.Verb).map((form) => form.features);
    expect(forms("ویستن")).toContain("دەمەوێت");
    expect(features.some((f) => f["mood"] === "imperative" || f["voice"] === "passive")).toBe(false);
  });

  it("builds verbs it was never told about", () => {
    expect(makeVerb("قاز")).toBeNull();
    expect(makeVerb("نووسین")).toMatchObject({ past: "نووسی", present: "نووس", transitive: true });
    // A preverb and ەوە are taken apart when the rest is known.
    const withSuffix = makeVerb("کردنەوە", null, null, "guess", known);
    expect(withSuffix).toMatchObject({ suffix: "ەوە", past: "کرد" });
  });

  it("guesses a present stem from a past one", () => {
    expect(ckb.guessPresentStem("شکاند")).toBe("شکێن");
    expect(ckb.guessPresentStem("نارد")).toBe("نێر");
    expect(ckb.guessPresentStem("بوو")).toBe("ب");
    expect(ckb.guessPresentStem("زز")).toBe("زز");
    expect(ckb.pastStemOf("کردنەوە")).toBe("کرد");
    expect(ckb.pastStemOf("زز")).toBeNull();
  });

  it("merges persons that share a form", () => {
    const index = new FormIndex(core);
    const readings = index.lookup("دەکەن");
    expect(readings[0]?.features["person"]).toBe("2pl|3pl");
    expect(index.lookup("ززز")).toEqual([]);
    const size = index.verbs.size;
    index.add(core[0] as ckb.Verb);
    expect(index.verbs.size).toBe(size);
  });
});

describe("the analyzer", () => {
  const analyzer = new CkbAnalyzer();

  it("peels nominal suffixes", () => {
    const best = analyzer.best("کتێبەکەم");
    expect(best && segmentation(best)).toBe("کتێب+ەکە+م");
    expect(best?.features).toMatchObject({ definite: "def", number: "sg", enclitic: "1sg" });
  });

  it("finds a verb by its paradigm", () => {
    expect(analyzer.best("دەکەم")).toMatchObject({ lemma: "کردن", pos: "VERB" });
    expect(analyzer.lemmatize("دەکەم")).toBe("کردن");
  });

  it("has nothing to say about nothing", () => {
    expect(analyzer.analyze("")).toEqual([]);
    expect(analyzer.best("")).toBeNull();
    expect(analyzer.lemmatize("")).toBe("");
  });

  it("uses the lexicon for stems, proclitics and scores", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("ماڵ", "NOUN", null, 1000);
    const withLexicon = new CkbAnalyzer(lexicon);
    const best = withLexicon.best("لەماڵ");
    expect(best?.segments).toEqual([
      ["لە", "PREP.LE"],
      ["ماڵ", "STEM"],
    ]);
    expect(best?.surface).toBe("لەماڵ");
  });

  it("does not take a verb's infinitive with suffixes for a verb", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("کردن", "VERB", null, 10);
    const best = new CkbAnalyzer(lexicon).analyze("کردنەکە").find((reading) => reading.lemma === "کردن");
    expect(best?.pos).toBe("NOUN");
  });

  it("splits enclitics and definite suffixes", () => {
    expect(ckb.splitEnclitic("کتێبمان")).toEqual(["کتێب", "مان"]);
    expect(ckb.splitEnclitic("مم")).toEqual(["مم", null]);
    expect(ckb.splitDefinite("کتێبەکە")).toEqual(["کتێب", "ەکە"]);
    expect(ckb.splitDefinite("دەرگاکە")).toEqual(["دەرگا", "کە"]);
    expect(ckb.splitDefinite("کتێب")).toEqual(["کتێب", null]);
    expect(ckb.splitDefinite("کتکە")).toEqual(["کتکە", null]);
  });

  it("knows glides from vowels", () => {
    expect(ckb.endsWithVowel("پیاو")).toBe(false);
    expect(ckb.endsWithVowel("کوردی")).toBe(true);
    expect(ckb.endsWithVowel("دوو")).toBe(true);
    expect(ckb.endsWithVowel("")).toBe(false);
  });

  it("chooses the allomorph by sound in declension", () => {
    const cell = (stem: string, name: string) => decline(stem).find(([c]) => c === name)?.[1];
    expect(cell("دەرگا", "def.sg")).toBe("دەرگاکە");
    expect(cell("پیاو", "def.sg")).toBe("پیاوەکە");
    expect(cell("ماسی", "def.sg")).toBe("ماسییەکە");
    expect(cell("باکە", "pl")).toBeNull();
  });
});

describe("known zimankit limitations, to improve on and then record as exceptions", () => {
  it.todo("the agent clitic of a noun and light verb belongs on the noun part");
  it.todo("vowel + یان uses the sentence to choose plural or the 3pl clitic");
  it.todo("the progressive of a preverb verb puts the clitic before دە");
});
