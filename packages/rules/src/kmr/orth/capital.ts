import { kmr } from "@zimanyar/core";
import type { RawFinding, Rule, Token } from "../../model.js";

const LOWER_START = /^\p{Ll}/u;
const CLOSING = new Set([".", "!", "?"]);

/** A sentence starts with a capital, and Kurdish capitals follow Kurdish rules: i gives I, not İ. */
export const sentenceCapital: Rule = {
  id: "kmr.orth.capital",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const { tokens, words } of sentences) {
      const first = tokens[0] as Token;
      // Without closing punctuation it may be a list, a title or a phrase, not a sentence.
      if (first.kind !== "word" || words.length < 2 || !LOWER_START.test(first.text)) continue;
      if (!CLOSING.has((tokens.at(-1) as Token).text)) continue;
      const [initial = ""] = first.text;
      found.push({
        start: first.start,
        end: first.end,
        suggestions: [kmr.upper(initial) + first.text.slice(initial.length)],
      });
    }
    return found;
  },
};
