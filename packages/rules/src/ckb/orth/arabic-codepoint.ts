import { ckb } from "@zimanyar/core";
import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** Hamza alone is a matter of spelling the word differently: see arabic-only-letter. */
const table = new Map(Object.entries(ckb.CKB_CHAR_MAP).filter(([letter]) => letter !== "ء"));

/** Letters from Arabic or Persian keyboards that look like Kurdish ones. */
export const arabicCodepoint: Rule = {
  id: "ckb.orth.arabic-codepoint",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const fixed = Array.from(word.text, (letter) => table.get(letter) ?? letter).join("");
      if (fixed !== word.text) found.push({ start: word.start, end: word.end, suggestions: [fixed] });
    }
    return found;
  },
};
