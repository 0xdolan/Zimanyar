/**
 * Fail on circular imports inside a package, and on a package importing from a higher layer.
 * The engine must stay layered so that each part can be used without the ones above it.
 *
 *   tsx scripts/checks/check-imports.ts        (or: make check-imports)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Each package may import only from lower layers. Apps are above everything. */
export const LAYERS: Readonly<Record<string, number>> = {
  config: 0,
  data: 1,
  core: 2,
  rules: 3,
  checker: 4,
  i18n: 5,
  settings: 5,
  content: 5,
  ui: 5,
  editor: 5,
};

const IMPORT =
  /(?:^|\n)\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

export function importsOf(source: string): string[] {
  return Array.from(source.matchAll(IMPORT), (match) => (match[1] ?? match[2]) as string);
}

/** Every cycle in a graph of file to imported files, as the path that closes it. */
export function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const finished = new Set<string>();
  const path: string[] = [];
  const visit = (node: string): void => {
    const seen = path.indexOf(node);
    if (seen >= 0) {
      cycles.push([...path.slice(seen), node]);
      return;
    }
    if (finished.has(node)) return;
    path.push(node);
    for (const next of graph.get(node) ?? []) visit(next);
    path.pop();
    finished.add(node);
  };
  for (const node of graph.keys()) visit(node);
  return cycles;
}

/** Why a package may not import another, or null if it may. */
export function layerViolation(from: string, to: string): string | null {
  const [a, b] = [LAYERS[from], LAYERS[to]];
  if (a === undefined) return `${from} is not in the layer table`;
  if (b === undefined) return `${to} is not in the layer table`;
  return a > b ? null : `${from} (layer ${a}) may not import ${to} (layer ${b})`;
}

const typescriptFiles = (directory: string): string[] =>
  (readdirSync(directory, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".ts"))
    .map((file) => join(directory, file));

export function checkPackages(packages: string): string[] {
  const problems: string[] = [];
  for (const name of readdirSync(packages)) {
    const src = join(packages, name, "src");
    if (!existsSync(src)) continue;
    const graph = new Map<string, string[]>();
    for (const file of typescriptFiles(src)) {
      const local: string[] = [];
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        if (specifier.startsWith(".")) {
          local.push(resolve(dirname(file), specifier).replace(/\.js$/, ".ts"));
        } else if (specifier.startsWith("@zimanyar/")) {
          const target = (specifier.split("/")[1] as string).trim();
          const violation = layerViolation(name, target);
          if (violation) problems.push(`${relative(packages, file)}: ${violation}`);
        }
      }
      graph.set(file, local);
    }
    for (const cycle of findCycles(graph)) {
      problems.push(`circular import: ${cycle.map((file) => relative(packages, file)).join(" -> ")}`);
    }
  }
  return problems;
}

export function main(packages = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages")): number {
  const problems = checkPackages(packages);
  for (const problem of problems) console.error(problem);
  return problems.length > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
