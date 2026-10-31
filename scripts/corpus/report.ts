/**
 * Measure every rule on the gold corpus, with the real lexicons.
 *
 *   pnpm exec tsx scripts/corpus/report.ts        (or: make corpus, after make data)
 *
 * Exits 1 when a family misses its precision or recall target.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Checker } from "@zimanyar/checker";
import { lexiconPath, loadLexiconFile } from "@zimanyar/data/node";
import { type Category, ruleMeta, type Variety } from "@zimanyar/rules";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface CorpusLine {
  text: string;
  findings: { rule: string; span: string; fix?: string }[];
  source?: string;
  review?: string;
}

export interface Tally {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

const TARGETS: Partial<Record<Category, { precision: number; recall?: number }>> = {
  orthography: { precision: 0.98 },
  spelling: { precision: 0.9 },
  morphology: { precision: 0.9 },
  agreement: { precision: 0.9, recall: 0.6 },
};

export function readCorpus(directory: string): CorpusLine[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".jsonl"))
    .sort()
    .flatMap((file) =>
      readFileSync(join(directory, file), "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as CorpusLine),
    );
}

const add = (tallies: Map<string, Tally>, key: string, field: keyof Tally) => {
  const tally = tallies.get(key) ?? { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
  tally[field]++;
  tallies.set(key, tally);
};

/** Compare what was found with what the corpus says is there, by rule and covered text. */
export function score(
  lines: readonly CorpusLine[],
  find: (text: string) => { rule: string; span: string }[],
): { byRule: Map<string, Tally>; misses: string[] } {
  const byRule = new Map<string, Tally>();
  const misses: string[] = [];
  for (const line of lines) {
    const expected = line.findings.map((finding) => `${finding.rule}\0${finding.span}`);
    const remaining = [...expected];
    for (const { rule, span } of find(line.text)) {
      const at = remaining.indexOf(`${rule}\0${span}`);
      if (at >= 0) {
        remaining.splice(at, 1);
        add(byRule, rule, "truePositives");
      } else {
        add(byRule, rule, "falsePositives");
        misses.push(`false alarm ${rule} on "${span}": ${line.text}`);
      }
    }
    for (const missing of remaining) {
      const [rule = "", span = ""] = missing.split("\0");
      add(byRule, rule, "falseNegatives");
      misses.push(`missed ${rule} on "${span}": ${line.text}`);
    }
  }
  return { byRule, misses };
}

export const precision = ({ truePositives, falsePositives }: Tally) =>
  truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives);
export const recall = ({ truePositives, falseNegatives }: Tally) =>
  truePositives + falseNegatives === 0 ? 1 : truePositives / (truePositives + falseNegatives);

export function byFamily(
  byRule: ReadonlyMap<string, Tally>,
  categoryOf: (rule: string) => Category,
): Map<Category, Tally> {
  const families = new Map<Category, Tally>();
  for (const [rule, tally] of byRule) {
    const category = categoryOf(rule);
    const total = families.get(category) ?? { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
    total.truePositives += tally.truePositives;
    total.falsePositives += tally.falsePositives;
    total.falseNegatives += tally.falseNegatives;
    families.set(category, total);
  }
  return families;
}

export function failures(families: ReadonlyMap<Category, Tally>): string[] {
  const out: string[] = [];
  for (const [category, tally] of families) {
    const target = TARGETS[category];
    if (target === undefined) continue;
    if (precision(tally) < target.precision)
      out.push(`${category}: precision ${precision(tally).toFixed(2)} < ${target.precision}`);
    if (target.recall !== undefined && recall(tally) < target.recall) {
      out.push(`${category}: recall ${recall(tally).toFixed(2)} < ${target.recall}`);
    }
  }
  return out;
}

const percent = (value: number) => value.toFixed(2);

/* v8 ignore start: needs the full lexicons, and the Data job runs it for real */
async function main(): Promise<number> {
  const sections: string[] = [];
  const problems: string[] = [];
  for (const lang of ["ckb", "kmr"] as Variety[]) {
    const lines = readCorpus(join(ROOT, "corpus", lang));
    const checker = new Checker();
    if (existsSync(lexiconPath(lang))) checker.setLexicon(await loadLexiconFile(lang));
    else problems.push(`${lang}: no compiled lexicon: run make data`);
    const { byRule, misses } = score(lines, (text) =>
      checker.check(text, { lang }).map((finding) => ({
        rule: finding.ruleId,
        span: text.slice(finding.range.start, finding.range.end),
      })),
    );
    const families = byFamily(byRule, (rule) => ruleMeta(rule).category);
    const failed = failures(families);
    problems.push(...failed.map((failure) => `${lang} ${failure}`));
    const rows = [...byRule.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    sections.push(
      `### ${lang}: ${lines.length} sentences`,
      "",
      "| family | precision | recall |",
      "| --- | --- | --- |",
      ...[...families].map(
        ([family, tally]) => `| ${family} | ${percent(precision(tally))} | ${percent(recall(tally))} |`,
      ),
      "",
      "| rule | true | false alarm | missed |",
      "| --- | --- | --- | --- |",
      ...rows.map(
        ([rule, t]) => `| ${rule} | ${t.truePositives} | ${t.falsePositives} | ${t.falseNegatives} |`,
      ),
      "",
      ...misses.map((miss) => `- ${miss}`),
      "",
    );
  }
  const report = sections.join("\n");
  console.log(report);
  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary) appendFileSync(summary, `${report}\n`);
  for (const problem of problems) console.error(problem);
  return problems.length > 0 ? 1 : 0;
}

/* v8 ignore stop */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
