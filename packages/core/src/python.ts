/**
 * The places where Python's strings and regular expressions differ from JavaScript's, in one
 * module. zimankit's patterns are generated from its Python source and translated here, so a
 * difference is fixed once. See docs/dev/parity-exceptions.md for what cannot be matched.
 */

/** What Python's str.isspace() and \s accept. JavaScript adds U+FEFF and leaves out four controls and U+0085. */
const SPACE =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
/** What Python's \w accepts: letters, numbers and underscore, but not combining marks. */
const WORD = "\\p{L}\\p{N}_";

/** The one pattern with \S inside a class: "a space that is not a line break". */
const HORIZONTAL_SPACE = "[^\\S\\r\\n]";
const HORIZONTAL_SPACE_CLASS = `[${SPACE.replace("\\n", "").replace("\\r", "")}]`;

const SPACE_ONLY = new RegExp(`^[${SPACE}]$`, "u");
const EDGE_SPACE = new RegExp(`^[${SPACE}]+|[${SPACE}]+$`, "gu");

/** Python's str.isspace() for one character. */
export const isSpace = (character: string): boolean => SPACE_ONLY.test(character);

/** Python's str.strip(). */
export const strip = (text: string): string => text.replace(EDGE_SPACE, "");

/** Python's str.count(): occurrences that do not overlap. */
export function count(text: string, part: string): number {
  let found = 0;
  for (let at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + part.length)) found++;
  return found;
}

/** Python's str.translate(): replace or drop single characters. */
export function translate(text: string, table: ReadonlyMap<string, string>): string {
  let out = "";
  for (const character of text) out += table.get(character) ?? character;
  return out;
}

/**
 * Python's round(): the nearest decimal of the value's exact binary form, and a true tie goes
 * to the even digit. toFixed agrees except that it sends ties up.
 */
export function round(value: number, digits: number): number {
  const scaled = value * 10 ** digits;
  const isTie = Number.isInteger(value * 2 ** (digits + 1)) && Math.abs(scaled % 1) === 0.5;
  if (isTie) return (2 * Math.round(scaled / 2)) / 10 ** digits;
  return Number(value.toFixed(digits));
}

/** Translate a Python pattern to JavaScript. Always uses the u flag, as Python matches code points. */
export function pythonRegex(python: string, flags = ""): RegExp {
  const source = python.replaceAll(HORIZONTAL_SPACE, HORIZONTAL_SPACE_CLASS);
  let out = "";
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const character = source[i] as string;
    if (character === "\\") {
      const next = source[++i] as string;
      const outside: Record<string, string> = {
        s: `[${SPACE}]`,
        S: `[^${SPACE}]`,
        w: `[${WORD}]`,
        W: `[^${WORD}]`,
      };
      const inside: Record<string, string> = { s: SPACE, w: WORD };
      const translated = (inClass ? inside : outside)[next];
      if (translated === undefined && inClass && (next === "S" || next === "W")) {
        throw new Error(`\\${next} inside a character class cannot be translated: ${source}`);
      }
      out += translated ?? `\\${next}`;
    } else if (!inClass && character === "(" && source.startsWith("(?P<", i)) {
      out += "(?<";
      i += 3;
    } else {
      if (character === "[") inClass = true;
      else if (character === "]") inClass = false;
      out += character;
    }
  }
  return new RegExp(out, `${flags}u`);
}
