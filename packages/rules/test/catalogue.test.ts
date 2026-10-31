import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import lessons from "../lessons.json" with { type: "json" };
import {
  allRuleMeta,
  allRules,
  buildParagraph,
  createContext,
  NOTICE_RULE,
  type RuleMeta,
  renderMessage,
  ruleMeta,
  rulesFor,
  runRules,
  type Variety,
} from "../src/index.js";
import { LEXICONS } from "./test-lexicons.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const files = readdirSync(SRC, { recursive: true }) as string[];
const metas = allRuleMeta();
const pathOf = (id: string) => id.replaceAll(".", "/");
const varietyOf = (meta: RuleMeta, text: string): Variety =>
  meta.lang === "any" ? (/[؀-ۿ]/.test(text) && !/[a-z]/.test(text) ? "ckb" : "kmr") : meta.lang;

describe("every rule", () => {
  it("has metadata, an implementation and tests", () => {
    expect(metas.length).toBe(allRules().length);
    for (const rule of allRules()) {
      expect(() => ruleMeta(rule.id)).not.toThrow();
      const path = pathOf(rule.id);
      const [lang, family, name] = path.split("/") as [string, string, string];
      const stem = `${lang}/${family}/${name}`;
      expect(files, `${rule.id} needs ${stem}.ts`).toContain(`${stem}.ts`);
      expect(files, `${rule.id} needs ${stem}.meta.yaml`).toContain(`${stem}.meta.yaml`);
      if (rule !== NOTICE_RULE)
        expect(files, `${rule.id} needs ${stem}.test.ts`).toContain(`${stem}.test.ts`);
    }
  });

  describe.each(metas.map((meta) => [meta.id, meta] as const))("%s", (_id, meta) => {
    it("explains itself in three languages, with examples and a lesson", () => {
      for (const part of [meta.message, meta.reason]) {
        expect(part.en).not.toBe("");
        expect(part.ckb).not.toBe("");
        expect(part.kmr).not.toBe("");
        expect(part.ckb).toMatch(/[؀-ۿ]/);
      }
      expect(meta.examples.length).toBeGreaterThanOrEqual(2);
      expect(meta.lessons.length).toBeGreaterThanOrEqual(1);
    });

    it("links to lessons that exist", () => {
      const index = lessons as Record<string, Record<string, { title: string; anchors: string[] }>>;
      for (const lesson of meta.lessons) {
        const target = index[lesson.lang]?.[String(lesson.lessonId)];
        expect(target?.title).toBe(lesson.title);
        if (lesson.anchor !== "") expect(target?.anchors).toContain(lesson.anchor);
      }
    });

    it("finds the wrong form of each example and suggests the right one", () => {
      const rule = allRules().find((candidate) => candidate.id === meta.id);
      if (rule === undefined) throw new Error(meta.id);
      for (const example of meta.examples) {
        const lang = varietyOf(meta, example.wrong);
        const context = createContext(lang, { lexicon: LEXICONS[lang], strictness: "standard" });
        const found = runRules(buildParagraph(example.wrong, meta.notice ? "auto" : lang), [rule], context);
        expect(found.length, `${meta.id} should find ${example.wrong}`).toBeGreaterThan(0);
        const offered = found.flatMap((finding) => finding.suggestions.map((s) => s.text));
        if (offered.length > 0 && !meta.notice) {
          const fixes = found.map((finding) =>
            finding.suggestions.map(
              (s) =>
                example.wrong.slice(0, finding.range.start) + s.text + example.wrong.slice(finding.range.end),
            ),
          );
          expect(fixes.flat(), `${meta.id} should offer ${example.right}`).toContain(example.right);
        }
      }
    });

    it("leaves the right form of each example alone", () => {
      if (meta.notice) return;
      const rule = allRules().find((candidate) => candidate.id === meta.id);
      if (rule === undefined) throw new Error(meta.id);
      for (const example of meta.examples) {
        const lang = varietyOf(meta, example.right);
        const context = createContext(lang, { lexicon: LEXICONS[lang], strictness: "standard" });
        expect(runRules(buildParagraph(example.right, lang), [rule], context)).toEqual([]);
      }
    });
  });
});

describe("messages", () => {
  it("fills in values as plain text, in each language", () => {
    const ref = { key: "rule.any.repeat.word.message", params: { word: "<b>ez</b>" } };
    expect(renderMessage(ref, "en")).toBe("The word <b>ez</b> is written twice.");
    expect(renderMessage(ref, "kmr")).toContain("<b>ez</b>");
    expect(renderMessage(ref, "ckb")).toContain("<b>ez</b>");
  });

  it("leaves an unknown placeholder visible, and survives an unknown key", () => {
    expect(renderMessage({ key: "rule.any.repeat.word.message" }, "en")).toContain("{word}");
    expect(renderMessage({ key: "rule.no.such.rule.message" }, "en")).toBe("rule.no.such.rule.message");
    expect(renderMessage({ key: "nonsense" }, "en")).toBe("nonsense");
  });

  it("refuses a rule with no metadata", () => {
    expect(() => ruleMeta("no.such.rule")).toThrow("no metadata");
  });
});

describe("rulesFor", () => {
  it("gives each variety its own rules and the shared ones", () => {
    const ckbIds = rulesFor("ckb").map((rule) => rule.id);
    const kmrIds = rulesFor("kmr").map((rule) => rule.id);
    expect(ckbIds.every((id) => !id.startsWith("kmr."))).toBe(true);
    expect(kmrIds.every((id) => !id.startsWith("ckb."))).toBe(true);
    expect(ckbIds).toContain("any.repeat.word");
    expect(ckbIds).not.toContain(NOTICE_RULE.id);
  });
});
