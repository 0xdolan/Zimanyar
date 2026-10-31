import { readFileSync } from "node:fs";
import { contrastPairs, themes, underlines } from "@zimanyar/config/tokens";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCss, main as writeTokens } from "../brand/make-tokens.js";
import { contrast, findFailures, luminance, main } from "../checks/check-contrast.js";
import { ROOT } from "./helpers.js";

describe("contrast", () => {
  afterEach(() => vi.restoreAllMocks());

  it("computes the WCAG reference values", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("finds no failures in the real tokens", () => {
    expect(findFailures()).toEqual([]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(main()).toBe(0);
  });

  it("reports a pair below its minimum", () => {
    const failures = findFailures({ light: { ...themes.light, foreground: "#CCCCCC" } }, [
      { foreground: "foreground", background: "background", minimum: 4.5 },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.theme).toBe("light");
  });

  it("keeps gold out of text on paper: the focus ring is a darker gold in light", () => {
    expect(contrast(themes.light.primary, themes.light.background)).toBeLessThan(3);
    expect(contrastPairs.some((p) => p.foreground === "primary")).toBe(false);
    expect(contrast(themes.light.ring, themes.light.background)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the colours the specification fixes", () => {
    expect(themes.light.primary).toBe("#FEBD11");
    expect(themes.light.success).toBe("#1F7A3E");
    expect(themes.light.destructive).toBe("#D7263D");
  });
});

describe("tokens.css", () => {
  const css = renderCss();

  it("is in sync with tokens.ts", () => {
    expect(readFileSync(`${ROOT}/packages/config/tokens.css`, "utf8")).toBe(css);
  });

  it("defines every colour for both themes and for Tailwind", () => {
    for (const name of Object.keys(themes.light)) {
      expect(css).toContain(`--${name}: `);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain("prefers-reduced-motion");
  });

  it("gives each underline its own shape, so colour never carries it alone", () => {
    const styles = Object.values(underlines).map((u) => u.style);
    expect(new Set(styles).size).toBe(styles.length);
  });

  it("uses no physical properties or web fonts", () => {
    expect(css).not.toMatch(/margin-left|margin-right|padding-left|padding-right|text-align: (left|right)/);
    expect(css).not.toMatch(/https?:/);
  });
});

describe("make-tokens main", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes --check when the file is current", () => {
    expect(writeTokens(["--check"])).toBe(0);
  });

  it("rewrites the file identically", () => {
    expect(writeTokens([])).toBe(0);
    expect(writeTokens(["--check"])).toBe(0);
  });
});
