/** Colour for a terminal, and nothing when the output is a file or NO_COLOR is set. */
export interface Paint {
  bold(text: string): string;
  dim(text: string): string;
  red(text: string): string;
  yellow(text: string): string;
  blue(text: string): string;
  green(text: string): string;
}

const ansi = (code: string) => (text: string) => `\u001b[${code}m${text}\u001b[0m`;
const plain = (text: string) => text;

export function paintFor(tty: boolean, env: Readonly<Record<string, string | undefined>>): Paint {
  const on = (tty || env["FORCE_COLOR"] !== undefined) && !env["NO_COLOR"] && env["TERM"] !== "dumb";
  return on
    ? {
        bold: ansi("1"),
        dim: ansi("2"),
        red: ansi("31"),
        yellow: ansi("33"),
        blue: ansi("34"),
        green: ansi("32"),
      }
    : { bold: plain, dim: plain, red: plain, yellow: plain, blue: plain, green: plain };
}

/**
 * Text from a checked file as a terminal may show it: control characters, which could move the cursor
 * or rewrite the screen, are written out as \\u escapes instead.
 */
export const shown = (text: string): string =>
  text.replace(/[\p{Cc}\u2028\u2029]/gu, (character) =>
    character === "\t"
      ? character
      : `\\u${(character.codePointAt(0) as number).toString(16).padStart(4, "0")}`,
  );

/** The escape codes paintFor writes, which take no room. */
const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Columns a text takes in a terminal: marks and joiners take none. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const character of text.replace(COLOUR, "")) {
    if (/[\p{M}\u200b-\u200f\u2066-\u2069\ufeff]/u.test(character)) continue;
    width++;
  }
  return width;
}

const pad = (text: string, width: number) => text + " ".repeat(Math.max(0, width - displayWidth(text)));

/** Rows as aligned columns, with a rule under the header. */
export function table(header: readonly string[], rows: readonly (readonly string[])[], paint: Paint): string {
  const widths = header.map((cell, column) =>
    Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[column] ?? ""))),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, column) => pad(cell, widths[column] as number))
      .join("  ")
      .trimEnd();
  return [
    paint.bold(line(header)),
    paint.dim(widths.map((width) => "-".repeat(width)).join("  ")),
    ...rows.map((row) => line(row)),
  ].join("\n");
}
