import { baseConfig } from "@zimanyar/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    esbuild: { jsx: "automatic" },
    test: { include: ["test/**/*.test.ts"], coverage: { include: ["src/routes.ts", "src/writing.ts"] } },
  }),
);
