/**
 * Enforce the spelling and terminology rules of CLAUDE.md (Writing):
 *
 * - "Kurdish" in Arabic script is کوردی and Kurdistan is کوردستان. The spellings
 *   with a bare ک, and the Arabic-letter ones, are rejected. Sorani کردی is also the
 *   verb "did it", so lesson content, data and the corpus are exempt from that one.
 * - Kurdish is an Indo-European language in its own right: never call it "Iranian".
 *
 * A line containing `kurdish-spelling: allow` is skipped.
 *
 *   tsx scripts/checks/check-kurdish-spelling.ts            all tracked and untracked files
 *   tsx scripts/checks/check-kurdish-spelling.ts FILE...    only these files
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

interface Rule {
  id: string;
  message: string;
  pattern: RegExp;
  /** Paths (prefixes) where the rule does not apply. */
  exempt: readonly string[];
}

// Letters and combining marks of any script count as part of a word.
const before = "(?<![\\p{L}\\p{M}])";
const after = "(?![\\p{L}\\p{M}])";

/** Files that quote the forbidden forms in order to forbid them. */
const RULE_DOCUMENTS = [
  "CLAUDE.md",
  "CONTRIBUTING.md",
  ".claude/skills/",
  "scripts/checks/check-kurdish-spelling.ts",
  "scripts/test/check-kurdish-spelling.test.ts",
  // Holds misspellings on purpose: the rule that catches them.
  "packages/rules/src/ckb/orth/arabic-codepoint",
];

/** Content where Sorani کردی is the past of کردن (to do). */
const KURDISH_TEXT = ["packages/content/lessons/", "packages/content/fixtures/", "packages/data/", "corpus/"];

export const RULES: readonly Rule[] = [
  {
    id: "kurdistan",
    message: "write Kurdistan as کوردستان",
    // کردستان, كردستان (Arabic kaf), کُردستان (damma)
    pattern: new RegExp(`${before}[\\u06A9\\u0643]\\u064F?\\u0631\\u062F\\u0633\\u062A\\u0627\\u0646`, "u"),
    exempt: RULE_DOCUMENTS,
  },
  {
    id: "kurdish-arabic-letters",
    message: "write Kurdish as کوردی (Arabic-letter spelling found)",
    // كردي, كردى, كوردي: Arabic kaf or Arabic yeh
    pattern: new RegExp(
      `${before}(?:\\u0643\\u0648?\\u0631\\u062F[\\u064A\\u0649\\u06CC]|[\\u06A9\\u0643]\\u0648?\\u0631\\u062F[\\u064A\\u0649])${after}`,
      "u",
    ),
    exempt: RULE_DOCUMENTS,
  },
  {
    id: "kurdish",
    message: "write Kurdish as کوردی",
    // کردی, کُردی
    pattern: new RegExp(`${before}\\u06A9\\u064F?\\u0631\\u062F\\u06CC${after}`, "u"),
    exempt: [...RULE_DOCUMENTS, ...KURDISH_TEXT],
  },
  {
    id: "iranian",
    message: "Kurdish is an Indo-European language in its own right; do not call it Iranian",
    pattern:
      /\b(?:(?:north)?-?west(?:ern)?[\s-]+iranian|iranian\s+(?:language|languages|branch|family|group|tongue|dialect)s?)\b/i,
    exempt: RULE_DOCUMENTS,
  },
];

const ALLOW_MARKER = "kurdish-spelling: allow";

export function checkText(file: string, text: string): Violation[] {
  const rules = RULES.filter((rule) => !rule.exempt.some((prefix) => file.startsWith(prefix)));
  if (rules.length === 0) return [];
  const violations: Violation[] = [];
  text.split("\n").forEach((content, index) => {
    if (content.includes(ALLOW_MARKER)) return;
    for (const rule of rules) {
      if (rule.pattern.test(content)) {
        violations.push({ file, line: index + 1, rule: rule.id, text: rule.message });
      }
    }
  });
  return violations;
}

const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|zst|gz|zip|pdf)$/i;

function listFiles(root: string): string[] {
  const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split("\0").filter((file) => file !== "" && !BINARY.test(file) && file !== "LICENSE");
}

export function main(args: readonly string[]): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = args.length > 0 ? [...args] : listFiles(root);
  const violations: Violation[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(resolve(root, file), "utf8");
    } catch {
      continue; // deleted in the working tree
    }
    violations.push(...checkText(file, text));
  }
  for (const v of violations) console.error(`${v.file}:${v.line}: [${v.rule}] ${v.text}`);
  if (violations.length > 0) {
    console.error(`${violations.length} Kurdish spelling or terminology problem(s); see CLAUDE.md, Writing`);
    return 1;
  }
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
