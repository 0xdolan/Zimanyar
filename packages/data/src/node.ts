import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lang, Lexicon } from "./lexicon.js";
import { loadLexicon } from "./load.js";

/** The folder where make data writes the compiled lexicons and the full fixtures. */
export const BUILD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../build");

export function lexiconPath(lang: Lang, directory = BUILD_DIR): string {
  return resolve(directory, `lexicon-${lang}.bin.gz`);
}

/** Load a compiled lexicon from disk, for the command line, the language server and tests. */
export function loadLexiconFile(lang: Lang, directory = BUILD_DIR): Promise<Lexicon> {
  return loadLexicon(readFileSync(lexiconPath(lang, directory)));
}

/**
 * The input and output pairs exported from zimankit: the full fixture when make data has run,
 * otherwise the small sample that is committed.
 */
export function readFixture<T>(name: string, directory = BUILD_DIR): T[] {
  const full = resolve(directory, "fixtures", `${name}.jsonl`);
  const path = existsSync(full) ? full : resolve(directory, "../fixtures", `${name}.jsonl`);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as T);
}
