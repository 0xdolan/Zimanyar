/**
 * Fail on interface strings that are missing from a catalogue, keys no code uses, and keys code uses
 * that do not exist. Every string goes through t(), in all three languages.
 *
 *   pnpm exec tsx scripts/checks/check-i18n.ts        (or: make check-i18n)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOGUES = join(ROOT, "packages/i18n/src/catalogues");
const LANGS = ["en", "ckb", "kmr"];
const USED = /\bt\(\s*["'`]([\w.]+)["'`]/g;

export function usedKeys(source: string): string[] {
  return Array.from(source.matchAll(USED), (match) => match[1] as string);
}

export function findProblems(
  catalogues: Record<string, Record<string, string>>,
  used: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const reference = Object.keys(catalogues["en"] ?? {});
  for (const [lang, catalogue] of Object.entries(catalogues)) {
    for (const key of reference) if (!(key in catalogue)) problems.push(`${lang}: missing ${key}`);
    for (const key of Object.keys(catalogue)) {
      if (!reference.includes(key)) problems.push(`${lang}: ${key} is not in the English catalogue`);
    }
  }
  for (const key of used)
    if (!reference.includes(key)) problems.push(`code uses ${key}, which no catalogue has`);
  for (const key of reference) {
    const dynamic = /^(category|severity|lang|theme)\./.test(key);
    if (!used.has(key) && !dynamic) problems.push(`no code uses ${key}`);
  }
  return problems;
}

/* v8 ignore start: reads the whole repository, and make lint runs it for real */
function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return (readdirSync(directory, { recursive: true }) as string[])
    .filter((file) => /\.tsx?$/.test(file) && !/node_modules|\.test\.|dist\//.test(file))
    .map((file) => join(directory, file));
}

function main(): number {
  const catalogues = Object.fromEntries(
    LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(CATALOGUES, `${lang}.json`), "utf8"))]),
  );
  const files = ["packages/ui/src", "packages/editor/src", "packages/editor/demo", "apps"].flatMap((dir) =>
    sourceFiles(join(ROOT, dir)),
  );
  const used = new Set(files.flatMap((file) => usedKeys(readFileSync(file, "utf8"))));
  const problems = findProblems(catalogues, used);
  for (const problem of problems) console.error(problem);
  return problems.length > 0 ? 1 : 0;
}

/* v8 ignore stop */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
