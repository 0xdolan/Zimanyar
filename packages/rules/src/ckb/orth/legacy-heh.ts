import { ckb } from "@zimanyar/core";
import { allWords, hasForm } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const HEH = "ه";
const AE = "ە";
const ZWNJ = "‌";
const HEH_ZWNJ = HEH + ZWNJ;

/** The vowel typed as heh, by old keyboards and old encodings. */
export const legacyHeh: Rule = {
  id: "ckb.orth.legacy-heh",
  check({ sentences, text }, context) {
    const found: RawFinding[] = [];
    const isLegacyText = ckb.isLegacyEncoded(text);
    for (const word of allWords(sentences)) {
      let fixed = word.text.replaceAll(HEH_ZWNJ, AE);
      if (fixed.endsWith(HEH) && fixed.length > 2) {
        // A final heh is often a real heh, so it takes the lexicon, or a text that is legacy throughout.
        const candidate = fixed.slice(0, -1) + AE;
        const lexiconAgrees = hasForm(candidate, context) && !hasForm(fixed, context);
        if (lexiconAgrees || (context.lexicon === null && isLegacyText)) fixed = candidate;
      }
      if (fixed !== word.text) found.push({ start: word.start, end: word.end, suggestions: [fixed] });
    }
    return found;
  },
};
