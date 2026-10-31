import type { Rule } from "../../model.js";

/** A paragraph in another language is noticed, neutrally, and never checked. */
export const otherVariety: Rule = {
  id: "any.lid.other-variety",
  check(paragraph) {
    if (paragraph.otherLanguage === null) return [];
    return [
      {
        start: 0,
        end: paragraph.text.length,
        suggestions: [],
        params: { language: paragraph.otherLanguage },
      },
    ];
  },
};
