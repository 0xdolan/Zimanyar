/**
 * Fail when a production dependency has a licence that is not compatible with
 * GPL-3.0-or-later. Development tools are not distributed and are not checked.
 *
 *   tsx scripts/checks/check-licenses.ts        (or: make licenses)
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** SPDX identifiers that may be combined with GPL-3.0-or-later code. */
export const ALLOWED = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC0-1.0",
  "GPL-3.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "ISC",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "OFL-1.1",
  "Python-2.0",
  "Unicode-3.0",
  "Unlicense",
  "Zlib",
]);

/** True when an SPDX expression is satisfiable with allowed licences only. */
export function isAllowed(expression: string): boolean {
  const cleaned = expression.replace(/[()]/g, " ").trim();
  // "A OR B": one allowed alternative is enough; "A AND B": every part must be allowed.
  return cleaned
    .split(/\s+OR\s+/)
    .some((alternative) => alternative.split(/\s+AND\s+/).every((id) => ALLOWED.has(id.trim())));
}

const pnpmLicenses = () =>
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8" });

export function main(listLicenses: () => string = pnpmLicenses): number {
  const output = listLicenses();
  // pnpm prints a plain sentence instead of JSON when there are no production dependencies.
  const byLicense = (output.trimStart().startsWith("{") ? JSON.parse(output) : {}) as Record<
    string,
    { name: string }[]
  >;
  const rejected = Object.entries(byLicense).filter(([license]) => !isAllowed(license));
  for (const [license, packages] of rejected) {
    console.error(`${license}: ${packages.map((p) => p.name).join(", ")}`);
  }
  if (rejected.length > 0) {
    console.error(
      "licences above are not on the GPL-3.0 compatible allow list (scripts/checks/check-licenses.ts)",
    );
    return 1;
  }
  console.log("licences ok");
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
