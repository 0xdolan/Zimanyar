/**
 * Hold Mozilla's linter to its result on the Firefox build. No errors, and no warnings but React's own:
 * react-dom assigns innerHTML to support a prop this project never uses, and our code never does.
 *
 *   tsx scripts/checks/check-extension-lint.ts report.json build-folder
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

/** react-dom has two assignments, wherever the bundler puts it. */
const REACT_ASSIGNMENTS_PER_FILE = 2;
/** Only react-dom's own code has this. */
export const REACT_MARKER = "__reactFiber$";

export function findProblems({ errors, warnings }: Report, holdsReact: (file: string) => boolean): string[] {
  const problems = errors.map(({ code, file, message }) => `error ${code} in ${file}: ${message}`);
  const assignments = new Map<string, number>();
  for (const { code, file = "", message } of warnings) {
    if (code === "UNSAFE_VAR_ASSIGNMENT" && file !== "" && holdsReact(file)) {
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
  const [report, build] = process.argv.slice(2) as [string, string];
  const problems = findProblems(JSON.parse(readFileSync(report, "utf8")) as Report, (file) =>
    readFileSync(resolve(build, file), "utf8").includes(REACT_MARKER),
  );
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
/* v8 ignore stop */
