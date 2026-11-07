import { describe, expect, it } from "vitest";
import { ROOT, run, tempFile } from "./helpers.js";

const script = `${ROOT}/scripts/release/release-notes.sh`;
const changelog = tempFile(
  "CHANGELOG.md",
  [
    "# Changelog",
    "",
    "## [1.0.0] - 2026-11-07",
    "",
    "### Added",
    "",
    "- One",
    "",
    "## [0.10.0] - 2026-11-01",
    "",
    "- Ten",
    "",
    "## [0.1.0] - 2026-10-31",
    "",
    "- Older",
    "",
  ].join("\n"),
);

describe("release-notes.sh", () => {
  it("prints the newest section without its heading", () => {
    const { status, stdout } = run(script, ["1.0.0", changelog]);
    expect(status).toBe(0);
    expect(stdout).toBe("\n### Added\n\n- One\n");
  });

  it("does not take 0.10.0 for 0.1.0", () => {
    expect(run(script, ["0.1.0", changelog]).stdout).toBe("\n- Older\n");
    expect(run(script, ["0.10.0", changelog]).stdout).toBe("\n- Ten\n");
  });

  it("fails when the version has no section", () => {
    const { status, stderr } = run(script, ["2.0.0", changelog]);
    expect(status).toBe(1);
    expect(stderr).toContain("no section for 2.0.0");
  });
});
