import { describe, expect, it } from "vitest";
import { ckb, gloss, SimpleLexicon, segmentation } from "../src/index.js";

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

  it("gives ویستن clitic subjects, and its rare imperative and passive", () => {
    expect(forms("ویستن")).toContain("دەمەوێت");
    expect(forms("ویستن")).toContain("بتەوێ");
    expect(forms("ویستن")).toContain("ویسترا");
  });

  it("puts ب after a preverb, with the bare form as a variant", () => {
    const verb = makeVerb("هەڵگرتن", null, null, "core", known) as ckb.Verb;
    const found = conjugate(verb).filter(
      (form) => form.features["mood"] === "imperative" && form.features["person"] === "2sg",
    );
    expect(found.find((form) => !form.features["polarity"] && !form.features["variant"])?.form).toBe(
      "هەڵبگرە",
    );
    expect(found.find((form) => form.features["variant"] === "no_b")?.form).toBe("هەڵگرە");
  });

  it("spaces a form as the written standard does", () => {
    const spell = (infinitive: string, form: string) => {
      const verb = makeVerb(infinitive, null, null, "core", known) as ckb.Verb;
      const found = conjugate(verb).find((f) => f.form === form && !f.features["variant"]) as ckb.VerbForm;
      return ckb.standardSpelling(verb, found);
    };
    expect(spell("هەڵگرتن", "هەڵمگرت")).toBe("هەڵم گرت");
    expect(spell("هەڵگرتن", "هەڵدەگرم")).toBe("هەڵدەگرم");
    expect(spell("دەستپێکردن", "دەستپێدەکەم")).toBe("دەست پێ دەکەم");
    expect(spell("دەستپێکردن", "دەستپێمکرد")).toBe("دەستم پێ کرد");
    expect(spell("خواردن", "خواردم")).toBe("خواردم");
  });

  it("reads a verb written over several tokens, and leaves ordinary pairs alone", () => {
    const index = new FormIndex([
      ...core,
      makeVerb("هەڵگرتن", null, null, "core", known) as ckb.Verb,
      makeVerb("دەستپێکردن", null, null, "core", known) as ckb.Verb,
    ]);
    expect(index.lookupSplit(["هەڵم", "گرت"])?.[0]).toBe(2);
    expect(index.lookupSplit(["دەست", "پێ", "دەکەم"])?.[0]).toBe(3);
    expect(index.lookupSplit(["دەستم", "پێ", "کرد"])?.[0]).toBe(3);
    expect(index.lookupSplit(["پیاو", "هات"])).toBeNull();
    expect(index.lookupSplit(["هات"])).toBeNull();
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
    expect(ckb.guessPresentStem("دروو")).toBe("دروو");
    expect(ckb.guessPresentStem("دڕا", false)).toBe("دڕێ");
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
  it("puts the agent clitic of a noun and light verb on the noun part", () => {
    const verb = ckb.defaultIndex().verbs.get("دەستپێکردن") as ckb.Verb;
    const found = conjugate(verb).find(
      (form) =>
        form.features["agent"] === "1sg" &&
        form.features["tense"] === "past" &&
        form.features["aspect"] === "perfective" &&
        !form.features["variant"] &&
        !form.features["polarity"],
    ) as ckb.VerbForm;
    expect(ckb.standardSpelling(verb, found)).toBe("دەستم پێ کرد");
  });

  it("keeps both readings of vowel + یان: مامۆستایان", () => {
    const glosses = new ckb.CkbAnalyzer().analyze("مامۆستایان").map(gloss);
    expect(glosses).toContain("STEM+PL");
    expect(glosses).toContain("STEM+3PL");
  });

  it("puts the clitic before دە in the progressive of a preverb verb", () => {
    const verb = ckb.defaultIndex().verbs.get("هەڵگرتن") as ckb.Verb;
    const found = conjugate(verb).filter(
      (form) =>
        form.features["agent"] === "3sg" &&
        form.features["aspect"] === "progressive" &&
        !form.features["polarity"],
    );
    expect(found.find((form) => !form.features["variant"])?.form).toBe("هەڵیدەگرت");
    expect(found.find((form) => form.features["variant"] === "clitic_late")?.form).toBe("هەڵدەیگرت");
  });

  it.todo("vowel + یان uses the sentence to choose plural or the 3pl clitic");

  it("reads object clitics, the eastern marker and more", () => {
    const analyzer = new ckb.CkbAnalyzer();
    expect(analyzer.analyze("دەتبینم")[0]).toMatchObject({ lemma: "بینین", features: { object: "2sg" } });
    expect(analyzer.analyze("ئەچم")[0]).toMatchObject({ lemma: "چوون", features: { variant: "dialect_ae" } });
    expect(analyzer.analyze("گرتمی")[0]).toMatchObject({
      lemma: "گرتن",
      features: { object: "1sg", agent: "3sg" },
    });
    expect(analyzer.analyze("بینیمیت")[0]).toMatchObject({ lemma: "بینین", features: { object: "2sg" } });
    expect(analyzer.analyze("بۆمی")[0]).toMatchObject({ lemma: "بۆ", pos: "ADP" });
  });

  it("reads words built from known words", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("کار", "NOUN");
    lexicon.add("گوڵ", "NOUN");
    lexicon.add("گەنم", "NOUN");
    lexicon.add("خێرا", "ADJ");
    lexicon.add("ڕەش", "ADJ");
    lexicon.add("ماسی", "NOUN");
    lexicon.add("پەنجەرە", "NOUN");
    const analyzer = new ckb.CkbAnalyzer(lexicon);
    expect(analyzer.analyze("بێکار").map(gloss)).toContain("PRIV+STEM");
    expect(analyzer.analyze("گوڵەگەنم").map(gloss)).toContain("STEM+LINK+STEM");
    expect(analyzer.analyze("بەخێرایی").map(gloss)).toContain("CONFIX.BE+STEM+CONFIX.Y");
    expect(analyzer.analyze("ماسێکە").map((reading) => reading.lemma)).toContain("ماسی");
    expect(analyzer.analyze("پەنجەران").map((reading) => reading.lemma)).toContain("پەنجەرە");
  });

  it("reports the written standard, separately from what is impossible", () => {
    expect(ckb.validateWord("نیە")).toContain("the standard spelling is نییە");
    expect(ckb.structuralProblems("نیە")).toEqual([]);
    expect(ckb.validateWord("ڵات")).toContain("initial ڵ");
    expect(ckb.validateWord("چو").join()).toContain("final و");
    expect(ckb.validateWord(`سپی${String.fromCodePoint(0x200c)}یە`).join()).toContain("ZWNJ");
    expect(ckb.validateWord("ووشە").join()).toContain("initial وو");
    expect(ckb.validateWord("سەیییی").join()).toContain("more than three");
    expect(ckb.validateWord("")).toEqual(["empty"]);
  });

  it("keeps ڵڵ and ییی, and tells ر from ڕ", () => {
    const zwnj = String.fromCodePoint(0x200c);
    expect(ckb.normalize("ئەڵڵا")).toBe("ئەڵڵا");
    expect(ckb.normalize("سنەییی")).toBe("سنەییی");
    expect(ckb.normalize(`من${zwnj}و تۆ`)).toBe("من و تۆ");
    expect(ckb.normalize(`سپی${zwnj}یە`)).toBe("سپییە");
  });
});
