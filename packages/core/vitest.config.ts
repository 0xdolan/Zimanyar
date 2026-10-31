import { baseConfig } from "@zimanyar/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.test.ts"],
      testTimeout: 120_000,
      coverage: {
        include: ["src/**/*.ts"],
        exclude: ["src/generated/**"],
        thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  }),
);
