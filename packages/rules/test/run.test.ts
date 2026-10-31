import { describe, expect, it } from "vitest";
import { spellingFix } from "../src/helpers.js";
import {
  buildParagraph,
  createContext,
  findingId,
  type Rule,
  runRules,
  splitParagraphs,
  splitSentences,
  suggestionsFor,
} from "../src/index.js";
import { makeLexicon, nouns } from "./helpers.js";

const context = () => createContext("kmr", { lexicon: null, strictness: "standard" });
const at = (id: string, start: number, end: number, confidence?: number): Rule => ({
  id,
  check: () => [{ start, end, suggestions: ["x"], ...(confidence !== undefined ? { confidence } : {}) }],
});

describe("runRules", () => {
  const paragraph = buildParagraph("Ez hatim hatim û ez çûm.", "kmr");

  it("fills a finding in from the metadata", () => {
    const [finding] = runRules(paragraph, [at("any.repeat.word", 3, 14)], context());
    expect(finding).toMatchObject({
      ruleId: "any.repeat.word",
      lang: "any",
      category: "style",
      severity: "warning",
      range: { start: 3, end: 14 },
      confidence: 0.75,
      safeFix: false,
      message: { key: "rule.any.repeat.word.message" },
      reason: { key: "rule.any.repeat.word.reason" },
      suggestions: [{ text: "x" }],
    });
    expect(finding?.examples.length).toBeGreaterThanOrEqual(2);
    expect(finding?.lessons.length).toBeGreaterThanOrEqual(1);
  });

  it("moves findings by an offset", () => {
    expect(runRules(paragraph, [at("any.repeat.word", 3, 14)], context(), 100)[0]?.range).toEqual({
      start: 103,
      end: 114,
    });
  });

  it("hides findings below the mode's threshold", () => {
    const shaky = at("any.repeat.word", 3, 14, 0.5);
    expect(runRules(paragraph, [shaky], context())).toHaveLength(1);
    expect(
      runRules(paragraph, [shaky], createContext("kmr", { lexicon: null, strictness: "tolerant" })),
    ).toEqual([]);
    expect(runRules(paragraph, [at("any.repeat.word", 3, 14, 0.2)], context())).toEqual([]);
  });

  it("lowers confidence when the language is a guess", () => {
    const unsure = { ...paragraph, confidence: 0.3 };
    expect(runRules(unsure, [at("any.repeat.word", 3, 14)], context())[0]?.confidence).toBeCloseTo(0.55);
  });

  it("sorts by position, then family", () => {
    const found = runRules(
      paragraph,
      [at("any.repeat.word", 3, 14), at("any.space.punctuation", 3, 5), at("any.script.mixed", 0, 1)],
      context(),
    );
    expect(found.map((f) => f.ruleId)).toEqual([
      "any.script.mixed",
      "any.space.punctuation",
      "any.repeat.word",
    ]);
  });

  it("orders two findings in one place and family by rule", () => {
    const found = runRules(
      paragraph,
      [at("any.space.punctuation", 3, 5), at("any.script.mixed", 3, 5)],
      context(),
    );
    expect(found.map((f) => f.ruleId)).toEqual(["any.script.mixed", "any.space.punctuation"]);
  });

  it("reads analyses once per word, and uses the lexicon when there is one", () => {
    const withLexicon = createContext("kmr", {
      lexicon: makeLexicon("kmr", nouns([["mal", "f"]])),
      strictness: "standard",
    });
    const first = withLexicon.readings("mal\u00ea");
    expect(withLexicon.readings("mal\u00ea")).toBe(first);
    expect(first[0]?.features).toMatchObject({ gender: "f" });
    const sorani = createContext("ckb", { lexicon: null, strictness: "standard" });
    expect(sorani.readings("\u062f\u06d5\u06a9\u06d5\u0645")[0]?.lemma).toBe("\u06a9\u0631\u062f\u0646");
  });

  it("gives a stable id", () => {
    expect(findingId("r", 1, 2, "t")).toBe(findingId("r", 1, 2, "t"));
    expect(findingId("r", 1, 2, "t")).not.toBe(findingId("r", 1, 3, "t"));
    expect(findingId("r", 1, 2, "t")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("the document model", () => {
  it("splits sentences on terminal punctuation, with offsets", () => {
    const sentences = splitSentences("Ez hatim. Tu çûyî! هات؟ dawî");
    expect(sentences.map((s) => s.words.length)).toEqual([2, 2, 1, 1]);
    expect(sentences[1]).toMatchObject({ start: 10, end: 18 });
    expect(sentences[0]?.tokens.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(splitSentences("")).toEqual([]);
  });

  it("splits paragraphs on line breaks, with offsets", () => {
    expect(splitParagraphs("a\n\nb c\nd")).toEqual([
      { start: 0, text: "a" },
      { start: 3, text: "b c" },
      { start: 7, text: "d" },
    ]);
    expect(splitParagraphs("")).toEqual([]);
  });

  it("identifies a paragraph's language, or takes the stated one", () => {
    const kurmanji = buildParagraph("Ez di malê de me û ji bo wê dibêje ku ew li gund e");
    expect(kurmanji).toMatchObject({ lang: "kmr", otherLanguage: null, script: "latin" });
    expect(buildParagraph("xxx", "ckb")).toMatchObject({ lang: "ckb", confidence: 1, otherLanguage: null });
  });

  it("falls back to the script when unsure", () => {
    expect(buildParagraph("kitêb").lang).toBe("kmr");
    expect(buildParagraph("کتێب").lang).toBe("ckb");
  });

  it("notices another language and does not call it Kurdish", () => {
    const english = buildParagraph("The children went to school this morning and the weather was very nice");
    expect(english.otherLanguage).toBe("eng");
    expect(english.lang).toBe("kmr");
  });
});

describe("suggestions left out of a check", () => {
  const deferred = (lexicon: ReturnType<typeof makeLexicon> | null) =>
    createContext("kmr", { lexicon, strictness: "standard", deferSuggestions: true });
  const lexicon = () => makeLexicon("kmr", nouns([["mal", "f"]]));

  it("names the word to ask about instead of searching", () => {
    expect(spellingFix("mak", deferred(lexicon()))).toEqual({ suggestions: [], lookup: "mak" });
  });

  it("searches when not deferred, and remembers the answer", () => {
    const context = createContext("kmr", { lexicon: lexicon(), strictness: "standard" });
    expect(spellingFix("mak", context).suggestions).toContain("mal");
    expect(spellingFix("mak", context).lookup).toBeUndefined();
    expect(suggestionsFor("mak", context)).toBe(suggestionsFor("mak", context));
  });

  it("carries the word through to the finding", () => {
    const rule: Rule = {
      id: "kmr.spell.unknown",
      check: () => [{ start: 3, end: 8, suggestions: [], lookup: "hatim" }],
    };
    const [finding] = runRules(buildParagraph("Ez hatim hatim û ez çûm.", "kmr"), [rule], deferred(null));
    expect(finding?.lookup).toBe("hatim");
    expect(finding?.suggestions).toEqual([]);
  });

  it("leaves it off a finding that has its suggestions", () => {
    const [finding] = runRules(
      buildParagraph("Ez hatim hatim û ez çûm.", "kmr"),
      [at("any.repeat.word", 3, 14)],
      context(),
    );
    expect(finding).not.toHaveProperty("lookup");
  });
});
