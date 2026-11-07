import { existsSync } from "node:fs";
import { lexiconPath } from "@zimanyar/data/node";
import { describe, expect, it } from "vitest";
import { uiLangOf } from "../src/cli.js";
import { displayWidth, paintFor, table } from "../src/terminal.js";
import { cli } from "./helpers.js";

describe("word tools", () => {
  it("analyzes a word, best reading first", async () => {
    const ran = await cli(["analyze", "پیاوەکان"]);
    expect(ran.code).toBe(0);
    expect(ran.out.split("\n")[2]).toMatch(/^پیاو\s+NOUN\s+پیاو\+ەکان\s+STEM\+DEF\.PL/);
  });

  // make data writes the lexicons, which the Test job does not run; the CLI job does.
  it.skipIf(!existsSync(lexiconPath("kmr")))("prefers the reading the lexicon knows", async () => {
    const json = JSON.parse((await cli(["analyze", "kitêbê", "--format", "json"])).out);
    expect(json[0]).toMatchObject({ lemma: "kitêb", pos: "NOUN" });
  });

  it("conjugates a verb, and builds one that is not in the core list", async () => {
    const ran = await cli(["conjugate", "dîtin"]);
    expect(ran.out).toContain("present stem bîn, past stem dît, transitive");
    expect(ran.out).toMatch(/ez \(1sg\)\s+dibînim\s+nabînim/);
    const json = JSON.parse((await cli(["conjugate", "نووسین", "--format", "json"])).out);
    expect(json).toMatchObject({ lang: "ckb", transitive: true });
    expect(json.sections[0].rows[0].forms[0]).toBe("دەنووسم");
  });

  it("rejects what is not an infinitive", async () => {
    const ran = await cli(["conjugate", "xyz"]);
    expect(ran.code).toBe(2);
    expect(ran.err).toContain("xyz");
  });

  it("declines a noun in the lexicon's gender, a given gender, or both", async () => {
    const known = await cli(["decline", "kitêb"]);
    expect(known.out).toContain("kitêb (feminine)");
    expect(known.out).toMatch(/ezafe sg\s+kitêba/);
    const given = await cli(["decline", "kitêb", "--gender", "m"]);
    expect(given.out).toMatch(/ezafe sg\s+kitêbê/);
    const unknown = await cli(["decline", "zzzbar"]);
    expect(unknown.out).toContain("(feminine)");
    expect(unknown.out).toContain("(masculine)");
    expect(unknown.err).toContain("--gender");
    const sorani = JSON.parse((await cli(["decline", "ماسی", "--format", "json"])).out);
    expect(sorani[0].forms).toContainEqual({ cell: "def.sg", label: "the … (sg)", form: "ماسییەکە" });
  });

  it("writes pronunciation, the other script and the standard spelling, from arguments or standard input", async () => {
    expect((await cli(["ipa", "Ez", "diçim"])).out).toBe("/ɛz dɪtʃɯm/\n");
    expect((await cli(["translit", "کوردستان"])).out).toBe("kurdistan\n");
    expect((await cli(["translit", "-"], { stdin: "Kurdistan\n" })).out).toBe("کوردستان\n");
    expect((await cli(["normalize"], { stdin: "كوردستان" })).out).toBe("کوردستان\n");
  });

  it("identifies a language", async () => {
    const ran = await cli(["lid", "Ez", "diçim", "malê", "û", "tu", "jî", "were"]);
    expect(ran.out).toMatch(/^kmr \(latin script\), confidence 1\.00/);
  });

  it("asks for exactly one word where one is needed", async () => {
    expect((await cli(["analyze"])).code).toBe(2);
    expect((await cli(["analyze", "a", "b"])).code).toBe(2);
  });
});

describe("explain", () => {
  it("explains a rule with examples, lessons and its page", async () => {
    const ran = await cli(["explain", "ckb.morph.definite-allomorph"]);
    expect(ran.out).toContain("Word form · Error · کوردی سۆرانی");
    expect(ran.out).toContain("دەرگاەکە  →  دەرگاکە");
    expect(ran.out).toContain("zimanyar lesson 7 --lang ckb");
    expect(ran.out).toContain("/rules/ckb.morph.definite-allomorph/");
  });

  it("says a rule for both varieties is for both, and when its fix is safe", async () => {
    const safe = await cli(["explain", "any.space.punctuation"]);
    expect(safe.out).toContain("Sorani and Kurmanji");
  });

  it("suggests rules close to a mistyped id", async () => {
    const ran = await cli(["explain", "ckb.definite"]);
    expect(ran.code).toBe(2);
    expect(ran.err).toContain("ckb.morph.definite-allomorph");
  });
});

describe("lesson", () => {
  it("lists every lesson, or those of one course", async () => {
    const all = await cli(["lesson"]);
    expect(all.out.split("\n").filter(Boolean).length).toBeGreaterThan(40);
    const kmr = await cli(["lesson", "--lang", "kmr"]);
    expect(kmr.out.split("\n").every((line) => line === "" || line.startsWith("kmr"))).toBe(true);
  });

  it("prints a lesson with its tables computed by the engine", async () => {
    const ran = await cli(["lesson", "7", "--lang", "ckb"]);
    expect(ran.out.split("\n")[0]).toBe("7. Nouns: the, a, and plurals");
    expect(ran.out).toMatch(/پیاو\s+man\s+پیاو \(pyaw\)\s+پیاوەکە \(pyaweke\)/);
    expect(ran.out).toContain("/learn/sorani/07-nouns/");
  });

  it("finds lessons by rule and by words, and asks to choose among several", async () => {
    const byRule = await cli(["lesson", "kmr.ergative.agreement"]);
    expect(byRule.out).toContain("kmr 14");
    const byWords = await cli(["lesson", "ergativity"]);
    expect(byWords.out).toContain("ckb 14  The past tense II");
    expect(byWords.err).toContain("--lang");
    const nothing = await cli(["lesson", "astrophysics"]);
    expect(nothing.code).toBe(2);
  });
});

describe("help and version", () => {
  it("prints help for everything and for one command", async () => {
    const all = await cli(["--help"]);
    expect(all.code).toBe(0);
    expect(all.out).toContain("zimanyar check [files…|-]");
    expect(all.out).toContain("Exit codes");
    const one = await cli(["conjugate", "--help"]);
    expect(one.out.startsWith("zimanyar conjugate <infinitive>")).toBe(true);
    expect((await cli(["help", "lesson"])).out).toContain("Read a lesson in the terminal");
  });

  it("prints help to the error stream with exit code 2 when called with nothing", async () => {
    const ran = await cli([]);
    expect(ran.code).toBe(2);
    expect(ran.err).toContain("Commands:");
  });

  it("prints the version of the program and of its data", async () => {
    expect((await cli(["--version"])).out).toMatch(
      /^zimanyar \d+\.\d+\.\d+ \(data \d{4}\.\d+\.\d+, zimankit \d+\.\d+\.\d+\)\n$/,
    );
  });

  it("writes help in the interface language", async () => {
    expect((await cli(["--help", "--ui", "ckb"])).out).toContain("فەرمانەکان");
    expect((await cli(["--help"], { env: { LANG: "ku_TR.UTF-8" } })).out).toContain("Ferman:");
  });
});

describe("interface language", () => {
  it("takes --ui, then ZIMANYAR_UI, then the locale", () => {
    expect(uiLangOf("kmr", { LANG: "ckb_IQ.UTF-8" })).toBe("kmr");
    expect(uiLangOf(undefined, { ZIMANYAR_UI: "ckb", LANG: "en_GB.UTF-8" })).toBe("ckb");
    expect(uiLangOf(undefined, { LC_ALL: "ckb_IQ.UTF-8" })).toBe("ckb");
    expect(uiLangOf(undefined, { LC_MESSAGES: "ku_TR.UTF-8" })).toBe("kmr");
    expect(uiLangOf(undefined, { LANG: "kurdish" })).toBe("en");
    expect(uiLangOf(undefined, { LANG: "C.UTF-8" })).toBe("en");
    expect(uiLangOf(undefined, {})).toBe("en");
  });
});

describe("terminal", () => {
  it("measures text without its marks, joiners and colour", () => {
    expect(displayWidth("kitêb")).toBe(5);
    expect(displayWidth("ki\u0301têb")).toBe(5);
    expect(displayWidth("نامە\u200cیەک")).toBe(7);
    expect(displayWidth(paintFor(true, {}).red("abc"))).toBe(3);
  });

  it("aligns columns and leaves no trailing spaces", () => {
    const text = table(
      ["a", "bb"],
      [
        ["ccc", "d"],
        ["e", ""],
      ],
      paintFor(false, {}),
    );
    expect(text).toBe("a    bb\n---  --\nccc  d\ne");
  });

  it("colours only a terminal, or when FORCE_COLOR asks, and never for a dumb one", () => {
    expect(paintFor(false, {}).bold("x")).toBe("x");
    expect(paintFor(false, { FORCE_COLOR: "1" }).bold("x")).not.toBe("x");
    expect(paintFor(true, { TERM: "dumb" }).bold("x")).toBe("x");
  });
});
