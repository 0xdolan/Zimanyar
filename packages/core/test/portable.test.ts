import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const sources = (readdirSync(SRC, { recursive: true }) as string[]).filter(
  (file) => file.endsWith(".ts") && !file.startsWith("generated"),
);

/** The engine runs in workers, Node and Tauri, and must never reach the network. */
const FORBIDDEN = [
  /from "node:/,
  /require\(/,
  /\bprocess\./,
  /\bwindow\b/,
  /\bdocument\b/,
  /\blocalStorage\b/,
  /\bfetch\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bsendBeacon\b/,
  /\beval\(/,
  /\bnew Function\(/,
];

describe("the engine stays portable and private", () => {
  it("has source files to check", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s uses no platform or network API", (file) => {
    const text = readFileSync(join(SRC, file), "utf8");
    for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
  });
});
