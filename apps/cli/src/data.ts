import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Lang, type Lexicon, loadLexicon } from "@zimanyar/data";

const fileName = (lang: Lang) => `lexicon-${lang}.bin.gz`;

/** A single executable carries the lexicons inside itself. */
function fromExecutable(lang: Lang): Uint8Array | null {
  try {
    // node:sea exists only in Node 20 and later, and answers only inside a single executable.
    const sea = process.getBuiltinModule?.("node:sea") as typeof import("node:sea") | undefined;
    if (sea === undefined || !sea.isSea()) return null;
    return new Uint8Array(sea.getAsset(fileName(lang)));
  } catch {
    return null;
  }
}

/**
 * Where lexicon files may be: ZIMANYAR_DATA, the data folder next to the bundle, and from source the
 * folder make data writes.
 */
function dataDirectories(env: Readonly<Record<string, string | undefined>>): string[] {
  const directories: string[] = [];
  if (env["ZIMANYAR_DATA"]) directories.push(resolve(env["ZIMANYAR_DATA"]));
  if (typeof __dirname === "string") directories.push(join(__dirname, "data"));
  // The bundle has no import.meta: there, only the folder beside it counts.
  const source: string | undefined = import.meta.url;
  if (typeof source === "string") {
    directories.push(resolve(dirname(fileURLToPath(source)), "../../../packages/data/build"));
  }
  return directories;
}

const loaded = new Map<Lang, Promise<Lexicon | null>>();

/** A variety's lexicon, or null when none is installed: the checker then runs without one. */
export function lexiconFor(
  lang: Lang,
  env: Readonly<Record<string, string | undefined>>,
): Promise<Lexicon | null> {
  let lexicon = loaded.get(lang);
  if (lexicon === undefined) {
    const bytes =
      fromExecutable(lang) ??
      dataDirectories(env)
        .map((directory) => join(directory, fileName(lang)))
        .filter((path) => existsSync(path))
        .map((path) => new Uint8Array(readFileSync(path)))[0] ??
      null;
    lexicon = bytes === null ? Promise.resolve(null) : loadLexicon(bytes);
    loaded.set(lang, lexicon);
  }
  return lexicon;
}
