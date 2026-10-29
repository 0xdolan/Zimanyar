import { defineConfig } from "vitest/config";

/**
 * Shared Vitest settings. Packages extend this with mergeConfig and raise the
 * coverage thresholds where the PRD asks for more (core, rules, checker: 90 %).
 */
export const baseConfig = defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
