import { baseConfig } from "@zimanyar/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    esbuild: { jsx: "automatic" },
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
      coverage: {
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/components/ui/**", "src/index.ts"],
      },
    },
  }),
);
