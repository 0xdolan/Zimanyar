/**
 * Hold every colour pair of the design tokens to WCAG 2.2 AA in both themes.
 *
 *   tsx scripts/checks/check-contrast.ts        (or: make check-contrast)
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ColorToken, type ContrastPair, contrastPairs, themes } from "@zimanyar/config/tokens";

function channel(hex: string, start: number): number {
  const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a #RRGGBB colour (WCAG 2.2). */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** Contrast ratio of two #RRGGBB colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Failure extends ContrastPair {
  theme: string;
  ratio: number;
}

export function findFailures(
  allThemes: Record<string, Record<ColorToken, string>> = themes,
  pairs: readonly ContrastPair[] = contrastPairs,
): Failure[] {
  return Object.entries(allThemes).flatMap(([theme, colors]) =>
    pairs.flatMap((pair) => {
      const ratio = contrast(colors[pair.foreground], colors[pair.background]);
      return ratio < pair.minimum ? [{ ...pair, theme, ratio }] : [];
    }),
  );
}

export function main(): number {
  const failures = findFailures();
  for (const f of failures) {
    console.error(
      `${f.theme}: ${f.foreground} on ${f.background} is ${f.ratio.toFixed(2)}:1, needs ${f.minimum}:1`,
    );
  }
  if (failures.length > 0) return 1;
  console.log(`contrast ok: ${contrastPairs.length} pairs in ${Object.keys(themes).length} themes`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
