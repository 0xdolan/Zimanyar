import { afterEach, describe, expect, it, vi } from "vitest";
import { checkText, main } from "../checks/check-kurdish-spelling.js";
import { run, tempFile } from "./helpers.js";

const rules = (file: string, text: string) => checkText(file, text).map((v) => v.rule);

describe("check-kurdish-spelling", () => {
  it("accepts the correct spellings", () => {
    expect(rules("packages/i18n/ckb.json", '"name": "کوردی"')).toEqual([]);
    expect(rules("README.md", "کوردستان")).toEqual([]);
    expect(rules("docs/a.md", "Kurdish is an Indo-European language.")).toEqual([]);
    expect(rules("docs/a.md", "Rojhilat (Iran) and Iranian state media")).toEqual([]);
  });

  it("rejects a bare kaf in Kurdish and Kurdistan", () => {
    expect(rules("packages/i18n/ckb.json", "کردی")).toEqual(["kurdish"]);
    expect(rules("README.md", "کردستان")).toEqual(["kurdistan"]);
    expect(rules("README.md", "کُردی")).toEqual(["kurdish"]);
  });

  it("rejects Arabic letters in Kurdish", () => {
    expect(rules("README.md", "كردي")).toEqual(["kurdish-arabic-letters"]);
    expect(rules("README.md", "کوردي")).toEqual(["kurdish-arabic-letters"]);
  });

  it("does not match inside longer words", () => {
    // the verb with a clitic or a negation prefix
    expect(rules("README.md", "کردیان")).toEqual([]);
    expect(rules("README.md", "نەکردی")).toEqual([]);
  });

  it("allows Sorani کردی (did it) in lessons, data and the corpus", () => {
    expect(rules("packages/content/lessons/ckb/14.mdx", "کردی")).toEqual([]);
    expect(rules("corpus/ckb/a.jsonl", "کردی")).toEqual([]);
    expect(rules("corpus/ckb/a.jsonl", "کردستان")).toEqual(["kurdistan"]);
  });

  it.each([
    "a West Iranian language",
    "Northwestern Iranian",
    "an Iranian language",
    "the Iranian languages",
  ])("rejects %j", (text) => {
    expect(rules("docs/a.md", text)).toEqual(["iranian"]);
  });

  it("honours the allow marker", () => {
    expect(rules("README.md", "کردی <!-- kurdish-spelling: allow -->")).toEqual([]);
  });

  // It reads every file in the repository, which on a slow machine takes a while.
  it("passes on the repository itself", () => {
    expect(run("pnpm", ["exec", "tsx", "scripts/checks/check-kurdish-spelling.ts"]).status).toBe(0);
  }, 60_000);
});

describe("check-kurdish-spelling main", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports each problem with file, line and rule", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = tempFile("ui.json", '{\n  "a": "کوردی",\n  "b": "کردی"\n}\n');
    expect(main([file])).toBe(1);
    expect(error).toHaveBeenCalledWith(`${file}:3: [kurdish] write Kurdish as کوردی`);
  });

  it("passes on clean files and skips files that do not exist", () => {
    expect(main([tempFile("ok.md", "کوردستان\n"), "does/not/exist.md"])).toBe(0);
  });

  it("checks every file of the repository when given none", () => {
    expect(main([])).toBe(0);
  });
});
