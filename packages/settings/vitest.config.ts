import { baseConfig } from "@zimanyar/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({ test: { coverage: { include: ["src/**/*.ts"], exclude: ["src/index.ts"] } } }),
);
