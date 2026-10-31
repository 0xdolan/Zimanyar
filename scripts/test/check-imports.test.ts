import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPackages, findCycles, importsOf, layerViolation, main } from "../checks/check-imports.js";

function packages(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zimanyar-imports-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("importsOf", () => {
  it("finds imports, re-exports and bare imports, and ignores strings", () => {
    const source = [
      'import a from "./a.js";',
      'import type { B } from "./b.js";',
      'export { c } from "./c.js";',
      'import "./d.js";',
      "import {\n  e,\n} from '@zimanyar/core';",
      'const text = "not from ./x.js";',
    ].join("\n");
    expect(importsOf(source)).toEqual(["./a.js", "./b.js", "./c.js", "./d.js", "@zimanyar/core"]);
  });
});

describe("findCycles", () => {
  it("finds a cycle and closes its path", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);
    expect(findCycles(graph)).toEqual([["a", "b", "c", "a"]]);
  });

  it("does not take shared imports for a cycle", () => {
    const graph = new Map([
      ["a", ["b", "c"]],
      ["b", ["d"]],
      ["c", ["d"]],
      ["d", []],
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("finds a file importing itself", () => {
    expect(findCycles(new Map([["a", ["a"]]]))).toEqual([["a", "a"]]);
  });
});

describe("layerViolation", () => {
  it("allows importing downwards only", () => {
    expect(layerViolation("core", "data")).toBeNull();
    expect(layerViolation("data", "core")).toContain("may not import");
    expect(layerViolation("ui", "editor")).toContain("may not import");
    expect(layerViolation("core", "core")).toContain("may not import");
  });

  it("refuses a package nobody placed", () => {
    expect(layerViolation("new", "data")).toContain("new is not in the layer table");
    expect(layerViolation("core", "new")).toContain("new is not in the layer table");
  });
});

describe("checkPackages", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports cycles and layer violations with their files", () => {
    const root = packages({
      "core/src/a.ts": 'import { b } from "./b.js";',
      "core/src/b.ts": 'import { a } from "./a.js";',
      "data/src/x.ts": 'import { y } from "@zimanyar/core/y";',
    });
    const problems = checkPackages(root);
    expect(problems.some((p) => p.startsWith("circular import: core/src/a.ts"))).toBe(true);
    expect(problems).toContain("data/src/x.ts: data (layer 1) may not import core (layer 2)");
  });

  it("accepts clean packages and skips those without a src folder", () => {
    const root = packages({
      "config/tokens.ts": "",
      "core/src/a.ts": 'import { b } from "./sub/b.js";\nimport { d } from "@zimanyar/data";',
      "core/src/sub/b.ts": "export const b = 1;",
    });
    expect(checkPackages(root)).toEqual([]);
    expect(main(root)).toBe(0);
  });

  it("main reports and fails", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(main(packages({ "core/src/a.ts": 'import "./a.js";' }))).toBe(1);
    expect(error).toHaveBeenCalled();
  });

  it("passes on the repository itself", () => {
    expect(main()).toBe(0);
  });
});
