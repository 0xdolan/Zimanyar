/**
 * Write packages/rules/lessons.json: each lesson's file, title and heading anchors, read from a
 * zimankit checkout. Rule metadata links to these anchors, and a test checks that they exist.
 *
 *   ZIMANKIT_DIR=../ku/zimankit pnpm exec tsx scripts/content/export-lesson-index.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** GitHub's heading slug: lower case, no punctuation, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/* v8 ignore start: needs a zimankit checkout */
function main(): void {
  const zimankit = resolve(ROOT, process.env["ZIMANKIT_DIR"] ?? "../ku/zimankit");
  const out: Record<string, Record<string, { file: string; title: string; anchors: string[] }>> = {};
  for (const lang of ["ckb", "kmr"]) {
    out[lang] = {};
    for (const level of ["1-beginner", "2-intermediate", "3-advanced"]) {
      const directory = join(zimankit, "docs/tutorials", lang, level);
      for (const file of readdirSync(directory).sort()) {
        const text = readFileSync(join(directory, file), "utf8");
        const headings = Array.from(text.matchAll(/^#{1,3} (.+)$/gm), (match) => match[1] as string);
        const number = String(Number(file.slice(0, 2)));
        (out[lang] as Record<string, unknown>)[number] = {
          file: `${level}/${file}`,
          title: (headings[0] as string).replace(/^\d+\.\s*/, ""),
          anchors: headings.slice(1).map(slug),
        };
      }
    }
  }
  writeFileSync(resolve(ROOT, "packages/rules/lessons.json"), `${JSON.stringify(out, null, 2)}\n`);
}

/* v8 ignore stop */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
