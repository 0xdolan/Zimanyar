import { describe, expect, it } from "vitest";
import { kmr, SimpleLexicon, segmentation } from "../src/index.js";

const {
  conjugate,
  decline,
  detectAlignment,
  KmrAnalyzer,
  loadCoreVerbs,
  lower,
  makeVerb,
  normalize,
  toArabic,
  toIpa,
  upper,
  validateWord,
} = kmr;

describe("orthography, from the rule catalogue", () => {
  it.each([
    ["dıçım", "diçim"], // Turkish dotless i
    ["şéwe", "şêwe"], // acute for circumflex
    ["șev", "şev"], // Romanian s
    ["HDP’ê", "HDP'ê"], // curly apostrophe
  ])("%s becomes %s", (wrong, right) => {
    expect(normalize(wrong)).toBe(right);
  });

  it("is idempotent", () => {
    const text = "Dıçım HDP’ê 'şéwe'";
    expect(normalize(normalize(text))).toBe(normalize(text));
  });

  it("changes case the Kurdish way, never the Turkish way", () => {
    expect(lower("İro IRO ÎŞKÊ")).toBe("iro iro îşkê");
    expect(upper("iro îşkê")).toBe("IRO ÎŞKÊ");
  });

  it("keeps an apostrophe only where it means something", () => {
    expect(normalize("'erd")).toBe("'erd");
    expect(normalize("'quoted'")).toBe("quoted");
    expect(normalize("HDP'yê", { keepApostrophe: false })).toBe("HDPyê");
  });

  it("names what is wrong with a word", () => {
    expect(validateWord("")).toEqual(["empty"]);
    expect(validateWord("kitêb")).toEqual([]);
    expect(validateWord("kurrrd")).toContain("tripled letter");
    expect(validateWord("kitöb")[0]).toContain("foreign letter(s)");
    expect(validateWord("kit1b")[0]).toContain("non-Hawar character(s): 1");
    expect(validateWord("bcdfg")).toContain("four consonants in a row");
    expect(validateWord("bcd")).toContain("no vowel");
    expect(validateWord("aeu")).toContain("three vowels in a row");
    expect(validateWord("bîîr")).toContain("doubled vowel");
  });
});

describe("phonology", () => {
  it("reads the digraphs and the rhotics", () => {
    expect(toIpa("xwe")).toBe("xʷɛ");
    expect(toIpa("rojn")).toMatch(/^r/);
    expect(toIpa("kir")).toBe("kɪɾ");
    expect(toIpa("kurr")).toBe("kʊr");
  });

  it("reduces the suffix vowel, unless asked not to", () => {
    expect(toIpa("dîtin")).toBe("diːtɯn");
    expect(toIpa("dîtin", { reducedSuffixI: false })).toBe("diːtɪn");
  });

  it("marks broad with slashes, narrow with brackets, and aspirates when narrow", () => {
    expect(toIpa("kir", {}, true)).toBe("/kɪɾ/");
    expect(toIpa("kir", { narrow: true }, true)).toBe("[kʰɪɾ]");
    expect(toIpa("k'ir", { narrow: true })).toBe("kɪɾ");
    expect(toIpa("bank", { narrow: true })).toBe("baːŋkʰ");
    expect(toIpa("gull", { narrow: true })).toBe("ɡʊɫ");
  });

  it("treats an apostrophe by position", () => {
    expect(toIpa("'erd")).toBe("ʕɛɾd");
    expect(toIpa("HDP'ê")).not.toContain("'");
  });

  it("renders a whole text, keeping punctuation", () => {
    expect(kmr.textToIpa("xwe .")).toBe("xʷɛ .");
  });
});

describe("the Arabic script", () => {
  it("writes long vowels and leaves short i unwritten", () => {
    expect(toArabic("kitêb")).toBe("کتێب");
    expect(toArabic("û")).toBe("و");
    expect(toArabic("")).toBe("");
  });

  it("gives a word-initial vowel its hamza seat", () => {
    expect(toArabic("ez")).toBe("ئەز");
    expect(toArabic("in")).toBe("ئن");
  });

  it("writes the trill and the velar l", () => {
    expect(toArabic("roj")).toBe("ڕۆژ");
    expect(toArabic("kurr")).toBe("کوڕ");
    expect(toArabic("gull")).toBe("گوڵ");
  });

  it("writes a vowel hiatus, and drops an inner apostrophe", () => {
    expect(toArabic("hea")).toBe("هەئا");
    expect(toArabic("HDP'ê")).toBe("هدپێ");
  });

  it("converts a whole text", () => {
    expect(kmr.textToArabic("ez .")).toBe("ئەز .");
  });
});

describe("verbs", () => {
  const core = loadCoreVerbs();
  const known = new Map(core.map((verb) => [verb.infinitive, verb]));
  const forms = (infinitive: string) => conjugate(known.get(infinitive) as kmr.Verb).map((form) => form.form);

  it("contracts ê and î stems with the prefixes", () => {
    expect(forms("hatin")).toEqual(expect.arrayContaining(["têm", "nayêm", "bêm", "neyê"]));
  });

  it("negates zanîn and karîn with ni-", () => {
    expect(forms("zanîn")).toContain("nizanim");
    // karîn is not a core verb, so it is built from its infinitive and present stem.
    const karin = makeVerb("karîn", null, "kar") as kmr.Verb;
    expect(conjugate(karin).map((form) => form.form)).toContain("nikarim");
  });

  it("shortens î before y in the past and the perfect", () => {
    expect(forms("zanîn")).toContain("zaniye");
  });

  it("agrees with the object in the past of a transitive verb", () => {
    const past = conjugate(known.get("dîtin") as kmr.Verb).find((form) => form.form === "dîtî");
    expect(past?.features).toMatchObject({ agreement: "object", alignment: "ergative", person: "2sg" });
  });

  it("gives hatin and çûn their irregular imperatives", () => {
    expect(forms("hatin")).toEqual(expect.arrayContaining(["were", "werin"]));
    expect(forms("çûn")).toEqual(expect.arrayContaining(["here", "herin"]));
  });

  it("builds verbs it was never told about", () => {
    expect(makeVerb("xx")).toBeNull();
    expect(makeVerb("bazdan")).toMatchObject({ past: "bazda", transitive: true });
    expect(makeVerb("rakirin", null, null, "guess", known)).toMatchObject({ preverb: "ra", past: "kir" });
    expect(makeVerb("kirin", null, null, "guess", known)).toBe(known.get("kirin"));
  });

  it("guesses stems", () => {
    expect(kmr.guessPresentStem("kuhand")).toBe("kuhîn");
    expect(kmr.guessPresentStem("kirî")).toBe("kir");
    expect(kmr.guessPresentStem("rest")).toBe("res");
    expect(kmr.guessPresentStem("hat")).toBe("hat");
    expect(kmr.pastStemOf("kirin")).toBe("kir");
    expect(kmr.pastStemOf("çûn")).toBe("çû");
    expect(kmr.pastStemOf("xx")).toBeNull();
  });

  it("does not index a verb twice", () => {
    const index = new kmr.FormIndex(core);
    const size = index.verbs.size;
    index.add(core[0] as kmr.Verb);
    expect(index.verbs.size).toBe(size);
    expect(index.lookup("xxx")).toEqual([]);
    expect(kmr.defaultIndex().lookup("têm").length).toBeGreaterThan(0);
  });
});

describe("the analyzer", () => {
  const analyzer = new KmrAnalyzer();

  it("finds a verb by its paradigm", () => {
    expect(analyzer.best("dîtî")).toMatchObject({ lemma: "dîtin", pos: "VERB" });
    expect(analyzer.lemmatize("têm")).toBe("hatin");
  });

  it("has nothing to say about nothing", () => {
    expect(analyzer.analyze("")).toEqual([]);
    expect(analyzer.best("")).toBeNull();
    expect(analyzer.lemmatize("")).toBe("");
  });

  it("keeps the -ê ambiguity without a gender, and resolves it with one", () => {
    const genders = (a: kmr.KmrAnalyzer, word: string, stem: string) =>
      a
        .analyze(word)
        .filter((reading) => reading.lemma === stem)
        .map((reading) => reading.features["gender"]);
    expect(genders(analyzer, "jinê", "jin").sort()).toEqual(["f", "m"]);
    const lexicon = new SimpleLexicon();
    lexicon.add("jin", "NOUN", "f", 100);
    lexicon.add("bav", "NOUN", "m", 100);
    const withGender = new KmrAnalyzer(lexicon);
    expect(withGender.best("jinê")?.features).toMatchObject({ case: "obl", gender: "f" });
    expect(withGender.best("bavê")?.features).toMatchObject({ ezafe: "yes", gender: "m" });
  });

  it("keeps the -ekî ambiguity", () => {
    const readings = analyzer.analyze("mirovekî").filter((r) => segmentation(r) === "mirov+ekî");
    expect(readings.map((r) => r.features["case"] ?? r.features["ezafe"]).sort()).toEqual(["obl", "yes"]);
  });

  it("recovers a stem that shortened before y", () => {
    expect(analyzer.analyze("xaniyê").some((reading) => reading.lemma === "xanî")).toBe(true);
  });

  it("marks down a suffix of the wrong gender and of the wrong word class", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("bav", "NOUN", "m", 100);
    lexicon.add("ji", "ADP", null, 100);
    const withLexicon = new KmrAnalyzer(lexicon);
    const score = (a: kmr.KmrAnalyzer, word: string, stem: string) =>
      a.analyze(word).find((reading) => reading.lemma === stem)?.score as number;
    expect(score(withLexicon, "bava", "bav")).toBeLessThan(score(withLexicon, "bavê", "bav"));
    expect(withLexicon.analyze("jia").length).toBeGreaterThan(0);
  });

  it("uses a function word's own features", () => {
    expect(analyzer.best("li")).toMatchObject({ pos: "ADP", features: { adptype: "prep" } });
  });

  it("reads an infinitive with a case suffix as a verbal noun", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("dîtin", "VERB", null, 10);
    const reading = new KmrAnalyzer(lexicon).analyze("dîtina").find((r) => r.lemma === "dîtin");
    expect(reading?.pos).toBe("NOUN");
  });

  it("chooses the allomorph in declension", () => {
    const cell = (stem: string, gender: kmr.Gender, name: string) =>
      decline(stem, gender).find(([c]) => c === name)?.[1];
    expect(cell("mal", "f", "def.obl.sg")).toBe("malê");
    expect(cell("bav", "m", "def.ez.sg")).toBe("bavê");
    expect(cell("xanî", "m", "def.ez.sg")).toBe("xaniyê");
    expect(cell("çiya", "m", "def.obl.sg")).toBe("çiya");
    expect(cell("çiya", "m", "voc.sg")).toBeNull();
    expect(kmr.attach("xanî", "yê")).toBe("xaniyê");
  });
});

describe("split ergativity", () => {
  it("flags Min tu dîtim: in the past the verb agrees with the object", () => {
    const record = detectAlignment("Min tu dîtim.");
    expect(record).toMatchObject({
      verb: "dîtim",
      lemma: "dîtin",
      alignment: "ergative",
      controller: "object",
      agreementOk: false,
    });
    expect(record.agent?.token).toBe("Min");
    expect(record.object?.token).toBe("tu");
    expect(record.notes[0]).toContain("verb ending marks 1sg but object 'tu' is 2sg");
  });

  it("accepts Min tu dîtî", () => {
    expect(detectAlignment("Min tu dîtî.")).toMatchObject({ agreementOk: true, tenseStem: "past" });
  });

  it("uses the subject in the present and for intransitive verbs", () => {
    expect(detectAlignment("Ez te dibînim.")).toMatchObject({
      alignment: "accusative",
      controller: "subject",
      agreementOk: true,
    });
    expect(detectAlignment("Ez hatim.")).toMatchObject({ alignment: "accusative", agreementOk: true });
    expect(detectAlignment("Ez diçe.")).toMatchObject({ agreementOk: false });
  });

  it("accepts dropped subjects and agents, and says so", () => {
    expect(detectAlignment("Dîtî.").notes).toEqual(
      expect.arrayContaining(["ergative clause without an overt oblique agent (pro-drop)"]),
    );
    expect(detectAlignment("Hatim.").notes[0]).toContain("subject not overt");
  });

  it("notices an object before its agent and an oblique subject in the present", () => {
    expect(detectAlignment("Tu min dîtî.").notes).toContain("object precedes agent (marked order)");
    expect(detectAlignment("Min dibînim.").notes).toContain(
      "oblique-case subject with a present-tense verb: check agreement",
    );
  });

  it("does not take a preposition's object for an argument", () => {
    expect(detectAlignment("Ez li malê hatim.").object).toBeNull();
    expect(detectAlignment("Li malê hatim.").agent).toBeNull();
  });

  it("reads nouns by case, with number from the suffix", () => {
    const lexicon = new SimpleLexicon();
    lexicon.add("jin", "NOUN", "f", 100);
    const analyzer = new KmrAnalyzer(lexicon);
    expect(detectAlignment("Jinê tu dîtî.", analyzer).agent?.token).toBe("Jinê");
    expect(detectAlignment("Jin hat.", analyzer).agent).toMatchObject({
      token: "Jin",
      person: "3sg",
      case: "dir",
    });
    expect(detectAlignment("Jinan tu dîtî.", analyzer).agent).toMatchObject({ person: "pl", case: "obl" });
    expect(detectAlignment("Jina me hat.", analyzer).agent?.token).not.toBe("Jina");
  });

  it("reports a sentence with no verb", () => {
    expect(detectAlignment("Kitêb.").notes).toEqual(["no finite verb found"]);
    expect(detectAlignment("").verb).toBeNull();
  });

  it("does not treat an imperative as the finite verb", () => {
    expect(detectAlignment("Were.").notes).toEqual(["no finite verb found"]);
  });
});

describe("known zimankit limitations, to improve on and then record as exceptions", () => {
  it.todo("a bare direct plural object is sg or pl: Min sêv xwarin is correct");
  it.todo("the lexicon's gender tells that jinê is an agent");
  it.todo("Min hatim gets its own message about an oblique subject");
  it.todo("the oblique of some masculine nouns changes its vowel: bajar, bajêr");
});
