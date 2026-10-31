import { Lexicon } from "@zimanyar/data";
import { buildLexicon } from "@zimanyar/data/builder";
import { describe, expect, it, vi } from "vitest";
import { applyFixes, Checker, createHandler, fixAllSafe } from "../src/index.js";

const lexiconBytes = () =>
  buildLexicon({
    lang: "kmr",
    zimankit: "t",
    data: "t",
    forms: [
      { word: "mal", lemma: "mal", upos: "NOUN", features: "{}", attested: true, zipf: 4, quality: "gold" },
    ],
    lemmas: [{ lemma: "mal", upos: "NOUN", gender: "f", zipf: 4, count: 10 }],
    variants: [],
  });

describe("Checker", () => {
  it("finds mistakes with offsets into the whole text", () => {
    const text = "Ez hatim.\nEz ez hatim.";
    const [finding] = new Checker().check(text, { lang: "kmr" });
    expect(finding?.ruleId).toBe("any.repeat.word");
    expect(text.slice(finding?.range.start, finding?.range.end)).toBe("Ez ez");
  });

  it("checks only what changed", () => {
    const checker = new Checker();
    checker.check("Ez ez hatim.\nTu çûyî.", { lang: "kmr" });
    expect(checker.cachedParagraphs).toBe(2);
    checker.check("Ez ez hatim.\nTu hatî.", { lang: "kmr" });
    expect(checker.cachedParagraphs).toBe(3);
  });

  it("moves cached findings to a paragraph's new position", () => {
    const checker = new Checker();
    const first = checker.check("Ez ez hatim.", { lang: "kmr" })[0];
    const moved = checker.check("Tu.\nEz ez hatim.", { lang: "kmr" })[0];
    expect(first?.range.start).toBe(0);
    expect(moved?.range.start).toBe(4);
    expect(moved?.id).not.toBe(first?.id);
  });

  it("gives the same id to the same finding in the same place", () => {
    const a = new Checker().check("Ez ez hatim.", { lang: "kmr" })[0];
    const b = new Checker().check("Ez ez hatim.", { lang: "kmr" })[0];
    expect(a?.id).toBe(b?.id);
  });

  it("keeps modes and rule choices apart in its cache", () => {
    const checker = new Checker();
    expect(checker.check("Ez ez.", { lang: "kmr" })).toHaveLength(1);
    expect(checker.check("Ez ez.", { lang: "kmr", disabledRules: ["any.repeat.word"] })).toEqual([]);
    expect(checker.check("Ez ez.", { lang: "kmr", strictness: "tolerant" })).toHaveLength(1);
  });

  it("drops the oldest paragraphs past its limit", () => {
    const checker = new Checker();
    const text = Array.from({ length: 2100 }, (_, i) => `a${i}`).join("\n");
    checker.check(text, { lang: "kmr" });
    expect(checker.cachedParagraphs).toBe(2000);
  });

  it("forgets its findings when a lexicon arrives", () => {
    const checker = new Checker();
    checker.check("Ez ez.", { lang: "kmr" });
    checker.setLexicon(new Lexicon(lexiconBytes()));
    expect(checker.cachedParagraphs).toBe(0);
  });

  it("notices another language and checks nothing else in it", () => {
    const text = "The the children went to school this morning and the weather was very nice";
    const found = new Checker().check(text);
    expect(found.map((f) => f.ruleId)).toEqual(["any.lid.other-variety"]);
  });

  it("checks by each paragraph's own language", () => {
    const found = new Checker().check(
      "Ez di malê de me û ji bo wê dibêje ku ew li gund e ku ku\nThe children went to school this morning and the weather was very nice",
    );
    expect(found.map((f) => f.ruleId)).toEqual(["any.repeat.word", "any.lid.other-variety"]);
  });
});

describe("applying fixes", () => {
  it("applies later ranges first, so offsets stay right", () => {
    const checker = new Checker();
    const text = "Ez ez hatim .";
    expect(applyFixes(text, checker.check(text, { lang: "kmr" }))).toBe("Ez hatim.");
  });

  it("skips a fix that overlaps another, and one with no suggestion", () => {
    const base = {
      id: "",
      ruleId: "r",
      lang: "any",
      category: "style",
      severity: "hint",
      message: { key: "" },
      reason: { key: "" },
      examples: [],
      lessons: [],
      confidence: 1,
      safeFix: true,
    } as const;
    const fix = (start: number, end: number, text: string) => ({
      ...base,
      range: { start, end },
      suggestions: [{ text }],
    });
    expect(applyFixes("abcdef", [fix(0, 4, "X"), fix(2, 5, "Y")])).toBe("abYf");
    expect(applyFixes("abc", [{ ...base, range: { start: 0, end: 1 }, suggestions: [] }])).toBe("abc");
  });

  it("fixes only what is safe, and repeats until settled", () => {
    const checker = new Checker();
    expect(fixAllSafe(checker, "Ez  ez hatim .", { lang: "kmr" })).toBe("Ez ez hatim.");
    expect(fixAllSafe(checker, "Ez hatim.", { lang: "kmr" })).toBe("Ez hatim.");
  });

  it("gives up on a fix that changes nothing", () => {
    const checker = new Checker();
    vi.spyOn(checker, "check").mockReturnValue([
      {
        id: "",
        ruleId: "r",
        lang: "any",
        category: "style",
        severity: "hint",
        range: { start: 0, end: 1 },
        message: { key: "" },
        reason: { key: "" },
        suggestions: [{ text: "a" }],
        examples: [],
        lessons: [],
        confidence: 1,
        safeFix: true,
      },
    ]);
    expect(fixAllSafe(checker, "a")).toBe("a");
  });

  it("stops after a few passes even if fixes never settle", () => {
    const checker = new Checker();
    const spy = vi.spyOn(checker, "check").mockImplementation((text) => [
      {
        id: "",
        ruleId: "r",
        lang: "any",
        category: "style",
        severity: "hint",
        range: { start: 0, end: 0 },
        message: { key: "" },
        reason: { key: "" },
        suggestions: [{ text: `${text}x` }],
        examples: [],
        lessons: [],
        confidence: 1,
        safeFix: true,
      },
    ]);
    fixAllSafe(checker, "a");
    expect(spy).toHaveBeenCalledTimes(5);
  });
});

describe("the worker's handler", () => {
  it("checks text", async () => {
    const handle = createHandler();
    const response = await handle({ type: "check", id: 1, text: "Ez ez.", options: { lang: "kmr" } });
    expect(response).toMatchObject({ type: "findings", id: 1 });
    expect(response.type === "findings" && response.findings[0]?.ruleId).toBe("any.repeat.word");
  });

  it("checks with no options", async () => {
    expect(await createHandler()({ type: "check", id: 2, text: "" })).toEqual({
      type: "findings",
      id: 2,
      findings: [],
    });
  });

  it("passes every option on", async () => {
    const response = await createHandler()({
      type: "check",
      id: 3,
      text: "Ez ez.",
      options: { lang: "kmr", strictness: "tolerant", disabledRules: ["any.repeat.word"] },
    });
    expect(response).toEqual({ type: "findings", id: 3, findings: [] });
  });

  it("applies safe fixes", async () => {
    expect(
      await createHandler()({ type: "fixSafe", id: 4, text: "Ez hatim .", options: { lang: "kmr" } }),
    ).toEqual({
      type: "fixed",
      id: 4,
      text: "Ez hatim.",
    });
  });

  it("loads a lexicon", async () => {
    expect(await createHandler()({ type: "load", id: 5, bytes: lexiconBytes() })).toEqual({
      type: "loaded",
      id: 5,
      lang: "kmr",
    });
  });

  it.each([
    [{ type: "nonsense", id: 6 }, 6],
    [{ type: "check", id: 7 }, 7],
    [{ type: "check", id: "8", text: "" }, -1],
    [{ type: "load", id: 9, bytes: "not bytes" }, 9],
    ["text", -1],
    [null, -1],
  ])("refuses a bad message: %j", async (message, id) => {
    expect(await createHandler()(message)).toEqual({ type: "error", id, message: "invalid request" });
  });

  it("reports a damaged lexicon rather than crashing", async () => {
    const response = await createHandler()({ type: "load", id: 10, bytes: new Uint8Array(4) });
    expect(response).toMatchObject({ type: "error", id: 10, message: "too short" });
  });

  it("reports something plain if a failure is not an Error", async () => {
    const response = await createHandler(undefined, () => {
      throw "odd";
    })({ type: "load", id: 11, bytes: new Uint8Array(4) });
    expect(response).toEqual({ type: "error", id: 11, message: "failed" });
  });
});
