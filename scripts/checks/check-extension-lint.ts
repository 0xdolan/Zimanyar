/**
 * Hold Mozilla's linter to its result on the Firefox build. No errors, and no warnings but React's own:
 * react-dom assigns innerHTML to support a prop this project never uses, and our code never does.
 *
 *   tsx scripts/checks/check-extension-lint.ts report.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Message {
  code: string;
  file?: string;
  message: string;
}
export interface Report {
  errors: Message[];
  warnings: Message[];
}

/** react-dom has two assignments, and it is bundled into each of these. */
const REACT_FILES = /^(content-scripts\/content\.js|chunks\/browser-page-[\w-]+\.js)$/;
const REACT_ASSIGNMENTS_PER_FILE = 2;

export function findProblems({ errors, warnings }: Report): string[] {
  const problems = errors.map(({ code, file, message }) => `error ${code} in ${file}: ${message}`);
  const assignments = new Map<string, number>();
  for (const { code, file = "", message } of warnings) {
    if (code === "UNSAFE_VAR_ASSIGNMENT" && REACT_FILES.test(file)) {
      assignments.set(file, (assignments.get(file) ?? 0) + 1);
    } else {
      problems.push(`warning ${code} in ${file}: ${message}`);
    }
  }
  for (const [file, count] of assignments) {
    if (count > REACT_ASSIGNMENTS_PER_FILE) {
      problems.push(
        `${file} assigns innerHTML ${count} times, more than react-dom's ${REACT_ASSIGNMENTS_PER_FILE}`,
      );
    }
  }
  return problems;
}

/* v8 ignore start: reads a report that make extension-lint writes */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = findProblems(JSON.parse(readFileSync(process.argv[2] as string, "utf8")) as Report);
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
/* v8 ignore stop */
