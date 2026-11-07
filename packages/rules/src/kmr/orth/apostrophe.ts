import type { RawFinding, Rule } from "../../model.js";

const APOSTROPHES = "’‘`´ʼʻʿʾ";
const INSIDE_A_WORD = new RegExp(`[\\p{L}]+[${APOSTROPHES}][\\p{L}]+`, "gu");
const ANY = new RegExp(`[${APOSTROPHES}]`, "gu");

/** A curly apostrophe or a look-alike between letters: HDP'ê takes the plain one. */
export const curlyApostrophe: Rule = {
  id: "kmr.orth.apostrophe",
  check({ text }) {
    const found: RawFinding[] = [];
    for (const match of text.matchAll(INSIDE_A_WORD)) {
      found.push({
        start: match.index,
        end: match.index + match[0].length,
        suggestions: [match[0].replace(ANY, "'")],
      });
    }
    return found;
  },
};
