import type { RawFinding, Rule } from "../../model.js";

const PUNCTUATION: Readonly<Record<string, string>> = { "?": "؟", ",": "،", ";": "؛" };
const toArabicDigits = (digits: string) =>
  digits.replace(/[0-9]/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));

/** Latin digits and punctuation in Arabic-script text: a matter of style, so only a hint. */
export const digitsPunct: Rule = {
  id: "ckb.orth.digits-punct",
  check({ sentences, script }) {
    if (script !== "arabic") return [];
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (const token of tokens) {
        const punctuation = PUNCTUATION[token.text];
        if (token.kind === "punct" && punctuation !== undefined) {
          found.push({ start: token.start, end: token.end, suggestions: [punctuation] });
        } else if (token.kind === "number" && /[0-9]/.test(token.text)) {
          found.push({ start: token.start, end: token.end, suggestions: [toArabicDigits(token.text)] });
        }
      }
    }
    return found;
  },
};
