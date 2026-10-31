import { baseConfig } from "@zimanyar/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.test.ts"],
      coverage: { include: ["brand/**/*.ts", "checks/**/*.ts", "release/**/*.ts"] },
    },
  }),
);
