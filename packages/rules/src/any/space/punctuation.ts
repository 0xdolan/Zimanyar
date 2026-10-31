import type { RawFinding, Rule } from "../../model.js";

const CLOSING = ".,;:!?،؛؟۔";
const CLOSING_RE = new RegExp(`[ \\t]+(?=[${CLOSING}])`, "gu");
/** After these a space is expected, unless a number, a URL or more punctuation continues. */
const NEEDS_SPACE_AFTER = /[,;!?،؛؟۔]/;
const LETTER = /[\p{L}\p{M}]/u;

/** Space before punctuation, a missing space after it, and doubled spaces. */
export const spacePunctuation: Rule = {
  id: "any.space.punctuation",
  check({ text }) {
    const found: RawFinding[] = [];
    for (const match of text.matchAll(CLOSING_RE)) {
      // Punctuation that opens a line, or an ellipsis after a space, is not a closing mark.
      if (match.index === 0 || text.startsWith("...", match.index + match[0].length)) continue;
      const end = match.index + match[0].length;
      found.push({ start: match.index, end: end + 1, suggestions: [text[end] as string] });
    }
    for (const match of text.matchAll(/ {2,}/g)) {
      const end = match.index + match[0].length;
      if (match.index === 0 || end === text.length || CLOSING.includes(text[end] as string)) continue;
      found.push({ start: match.index, end, suggestions: [" "] });
    }
    for (let i = 1; i < text.length - 1; i++) {
      const character = text[i] as string;
      if (
        NEEDS_SPACE_AFTER.test(character) &&
        LETTER.test(text[i - 1] as string) &&
        LETTER.test(text[i + 1] as string)
      ) {
        found.push({ start: i, end: i + 1, suggestions: [`${character} `] });
      }
    }
    return found;
  },
};
