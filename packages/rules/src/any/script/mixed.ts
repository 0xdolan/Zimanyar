import { charScript } from "@zimanyar/core";
import type { RawFinding, Rule } from "../../model.js";

/** One word with both Latin and Arabic letters is almost always a typing error. */
export const mixedScript: Rule = {
  id: "any.script.mixed",
  check(paragraph) {
    const found: RawFinding[] = [];
    for (const match of paragraph.text.matchAll(/[\p{L}\p{M}‌]+/gu)) {
      const scripts = new Set(Array.from(match[0], charScript));
      if (scripts.has("arabic") && scripts.has("latin")) {
        found.push({ start: match.index, end: match.index + match[0].length, suggestions: [] });
      }
    }
    return found;
  },
};
