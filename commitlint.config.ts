import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [1, "always", 100],
    "scope-enum": [
      1,
      "always",
      [
        "brand",
        "ci",
        "cli",
        "checker",
        "config",
        "content",
        "core",
        "data",
        "deps",
        "desktop",
        "docs",
        "editor",
        "extension",
        "i18n",
        "lsp",
        "release",
        "rules",
        "scripts",
        "settings",
        "ui",
        "web",
      ],
    ],
  },
};

export default config;
