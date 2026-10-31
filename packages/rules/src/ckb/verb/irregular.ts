import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

/** Regular-looking forms of verbs that are not regular. */
const FORMS: ReadonlyMap<string, string> = new Map([
  ["مەێ", "مەیە"],
  ["مەێن", "مەیەن"],
  ["دەوێم", "دەمەوێت"],
  ["دەوێیت", "دەتەوێت"],
  ["دەوێین", "دەمانەوێت"],
  ["ناوێم", "نامەوێت"],
  ["ناوێیت", "ناتەوێت"],
  ["ناوێین", "نامانەوێت"],
  ["ناێم", "نایەم"],
  ["ناێت", "نایەت"],
  ["ناێن", "نایەن"],
]);

/** The present of هاتن and of ویستن do not follow the regular pattern. */
export const irregularForm: Rule = {
  id: "ckb.verb.irregular",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const right = FORMS.get(word.text);
      if (right !== undefined) found.push({ start: word.start, end: word.end, suggestions: [right] });
    }
    return found;
  },
};
