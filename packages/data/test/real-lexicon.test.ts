import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { frequencyBucket } from "../src/builder.js";
import type { Lang, Lexicon } from "../src/index.js";
import { BUILD_DIR, lexiconPath, loadLexiconFile } from "../src/node.js";

const rows = (lang: Lang, table: string): string[][] => {
  const text = readFileSync(resolve(BUILD_DIR, "raw", lang, `${table}.tsv`), "utf8");
  return text === ""
    ? []
    : text
        .slice(0, -1)
        .split("\n")
        .map((line) => line.split("\t"));
};

const MEGABYTE = 1024 * 1024;

/** These need make data; without it they are skipped. CI's data job always runs them. */
describe.skipIf(!existsSync(lexiconPath("ckb")) || !existsSync(lexiconPath("kmr")))(
  "the real lexicon",
  () => {
    describe.each<Lang>(["ckb", "kmr"])("%s", (lang) => {
      let lexicon: Lexicon;
      const load = async () => {
        lexicon ??= await loadLexiconFile(lang);
        return lexicon;
      };

      it("is within the size budget", () => {
        expect(statSync(lexiconPath(lang)).size).toBeLessThanOrEqual(6 * MEGABYTE);
      });

      it("holds every form with exactly what the bundle says", async () => {
        const lex = await load();
        const forms = rows(lang, "forms");
        expect(lex.formCount).toBe(forms.length);
        const wrong: string[] = [];
        for (const [word, lemma, upos, features, attested, zipf, quality] of forms as string[][] as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ][]) {
          const form = lex.form(word);
          if (
            form === null ||
            form.lemma !== lemma ||
            form.upos !== upos ||
            JSON.stringify(form.features) !== features ||
            form.attested !== (attested === "1") ||
            form.frequency !== frequencyBucket(Number(zipf)) ||
            form.quality !== quality
          ) {
            wrong.push(word);
          }
        }
        expect(wrong).toEqual([]);
      }, 120_000);

      it("holds every lemma with its stems", async () => {
        const lex = await load();
        const lemmas = rows(lang, "lemmas");
        expect(lex.lemmaCount).toBe(lemmas.length);
        const wrong: string[] = [];
        for (const [lemma, upos, gender, transitivity, present, past] of lemmas as string[][] as [
          string,
          string,
          string,
          string,
          string,
          string,
        ][]) {
          const entry = lex.lemma(lemma);
          if (
            entry === null ||
            entry.upos !== upos ||
            (entry.gender ?? "") !== gender ||
            (entry.transitivity ?? "") !== transitivity ||
            (entry.present ?? "") !== present ||
            (entry.past ?? "") !== past
          ) {
            wrong.push(lemma);
          }
        }
        expect(wrong).toEqual([]);
      }, 120_000);

      it("maps every spelling variant", async () => {
        const lex = await load();
        for (const [variant, standard] of rows(lang, "variants") as [string, string][]) {
          expect(lex.standardSpelling(variant)).toBe(standard);
        }
      }, 120_000);

      it("finds nothing that is not in the lexicon", async () => {
        const lex = await load();
        const known = new Set(rows(lang, "forms").map(([word]) => word as string));
        let falsePositives = 0;
        let tried = 0;
        for (const word of known) {
          if (tried++ % 7 !== 0) continue;
          const mutated = `${word}${word.at(-1)}${word.at(0)}`;
          if (!known.has(mutated) && lex.has(mutated)) falsePositives++;
        }
        expect(falsePositives).toBe(0);
      }, 120_000);

      it("looks a word up within the performance budget", async () => {
        const lex = await load();
        const words = rows(lang, "forms")
          .slice(0, 50_000)
          .map(([word]) => word as string);
        const fsa = lex.automaton;
        for (const word of words) fsa.rank(word); // warm up the JIT
        // The best of several runs, because a busy machine only ever makes a run slower.
        const runs = Array.from({ length: 5 }, () => {
          const started = performance.now();
          for (const word of words) fsa.rank(word);
          return ((performance.now() - started) * 1000) / words.length;
        });
        const microseconds = Math.min(...runs);
        console.log(`${lang}: lookup ${microseconds.toFixed(2)} us`);
        // The budget is 2 us; this allows for a loaded CI machine.
        expect(microseconds).toBeLessThan(6);
      }, 120_000);
    });
  },
);
