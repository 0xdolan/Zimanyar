/**
 * Compile the exported tables into one lexicon file per language and report their sizes.
 *
 *   pnpm --filter @zimanyar/data build     (part of make data)
 *
 * The build skips itself when make data has not run, so a plain make build needs no download.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { Lang } from "@zimanyar/data";
import { Lexicon } from "@zimanyar/data";
import { buildLexicon, type FormRow, type LemmaRow } from "@zimanyar/data/builder";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = resolve(ROOT, "packages/data");
const BUILD = resolve(DATA, "build");
/** The product budget for one language's lexicon, compressed. */
export const MAX_COMPRESSED_BYTES = 6 * 1024 * 1024;

const rows = (path: string): string[][] => {
  const text = readFileSync(path, "utf8");
  // Only the final newline goes: a row may end in empty columns.
  return text === ""
    ? []
    : text
        .slice(0, -1)
        .split("\n")
        .map((line) => line.split("\t"));
};

const optional = (key: string, value: string | undefined) => (value ? { [key]: value } : {});

function readForm(fields: string[]): FormRow {
  const [word, lemma, upos, features, attested, zipf, quality] = fields as [
    string,
    string,
    string,
    string,
    string,
    string,
    FormRow["quality"],
  ];
  return { word, lemma, upos, features, attested: attested === "1", zipf: Number(zipf), quality };
}

function readLemma(fields: string[]): LemmaRow {
  const [lemma, upos, gender, transitivity, present, past, variantOf, seeAlso, zipf, count] = fields as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    lemma,
    upos,
    ...optional("gender", gender),
    ...optional("transitivity", transitivity),
    ...optional("present", present),
    ...optional("past", past),
    ...optional("variantOf", variantOf),
    ...optional("seeAlso", seeAlso),
    zipf: Number(zipf),
    count: Number(count),
  };
}

function readVersion(): { zimankit: string; data: string } {
  const lines = readFileSync(resolve(DATA, "VERSION"), "utf8").trim().split("\n");
  const fields = new Map(lines.map((line) => line.split("=") as [string, string]));
  const [zimankit, data] = [fields.get("zimankit"), fields.get("data")];
  if (zimankit === undefined || data === undefined) throw new Error("VERSION needs zimankit and data");
  return { zimankit, data };
}

function main(): number {
  const langs: Lang[] = ["ckb", "kmr"];
  if (!langs.every((lang) => existsSync(resolve(BUILD, "raw", lang, "forms.tsv")))) {
    console.log("no exported lexicon: run make data to build it");
    return 0;
  }
  const version = readVersion();
  // Committed: CI rebuilds and compares, which proves that another machine gets the same bytes.
  const lock: Record<string, unknown> = { zimankit: version.zimankit, data: version.data };
  let failed = false;
  for (const lang of langs) {
    const started = performance.now();
    const raw = resolve(BUILD, "raw", lang);
    const bytes = buildLexicon({
      lang,
      zimankit: version.zimankit,
      data: version.data,
      forms: rows(resolve(raw, "forms.tsv")).map(readForm),
      lemmas: rows(resolve(raw, "lemmas.tsv")).map(readLemma),
      variants: rows(resolve(raw, "variants.tsv")).map(([variant, standard]) => ({
        variant: variant as string,
        standard: standard as string,
      })),
    });
    const compressed = gzipSync(bytes, { level: 9 });
    writeFileSync(resolve(BUILD, `lexicon-${lang}.bin.gz`), compressed);
    const loadStarted = performance.now();
    const lexicon = new Lexicon(bytes);
    const loadMs = performance.now() - loadStarted;
    lock[lang] = {
      forms: lexicon.formCount,
      lemmas: lexicon.lemmaCount,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const mb = (compressed.length / 1024 / 1024).toFixed(2);
    console.log(
      `${lang}: ${lexicon.formCount} forms, ${lexicon.lemmaCount} lemmas, ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ` +
        `${mb} MB gzipped, built in ${((performance.now() - started) / 1000).toFixed(1)} s, loads in ${loadMs.toFixed(0)} ms`,
    );
    if (compressed.length > MAX_COMPRESSED_BYTES) {
      console.error(`${lang}: ${mb} MB is over the budget of 6 MB`);
      failed = true;
    }
  }
  writeFileSync(
    resolve(DATA, "lexicon.lock.json"),
    `${JSON.stringify(lock, null, 2)}
`,
  );
  return failed ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
