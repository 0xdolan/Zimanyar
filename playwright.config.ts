import { defineConfig } from "@playwright/test";

/**
 * Browser tests never touch anyone's own browser profile: each run gets a throwaway one. Locally they
 * use the installed Chrome, and in CI the Chromium that Playwright installs.
 */
export default defineConfig({
  testDir: "scripts/screenshots",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://localhost:4173",
    ...(process.env["CI"] ? {} : { channel: "chrome" }),
  },
  webServer: [
    {
      command: "pnpm --filter @zimanyar/ui demo:serve",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: "pnpm --filter @zimanyar/editor demo:serve",
      url: "http://localhost:4174",
      reuseExistingServer: !process.env["CI"],
    },
  ],
});
