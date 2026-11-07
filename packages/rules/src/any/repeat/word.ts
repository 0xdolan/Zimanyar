import type { RawFinding, Rule, Token } from "../../model.js";

/** Doubling these is ordinary Kurdish: slowly, often, one by one. */
const REDUPLICATED = new Set(
  [
    "hêðî",
    "hêdî",
    "zû",
    "kêm",
    "car",
    "gelek",
    "ser",
    "pir",
    "yek",
    "du",
    "sê",
    "هێواش",
    "زوو",
    "کەم",
    "جار",
    "زۆر",
    "یەک",
    "دوو",
    "سێ",
    "ورد",
    "پێش",
  ].map((word) => word.normalize("NFC")),
);

/** The same word twice in a row, usually a slip. */
export const repeatedWord: Rule = {
  id: "any.repeat.word",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (let i = 1; i < tokens.length; i++) {
        const previous = tokens[i - 1] as Token;
        const current = tokens[i] as Token;
        if (previous.kind !== "word" || current.kind !== "word") continue;
        const word = current.text.toLowerCase();
        if (word === previous.text.toLowerCase() && !REDUPLICATED.has(word)) {
          found.push({
            start: previous.start,
            end: current.end,
            suggestions: [previous.text],
            params: { word: current.text },
          });
        }
      }
    }
    return found;
  },
};
