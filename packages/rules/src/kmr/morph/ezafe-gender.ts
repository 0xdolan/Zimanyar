import { kmr } from "@zimanyar/core";
import { frequencyOf, wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { genderOf, likeCase, lowered, OBLIQUE_TO_DIRECT } from "../helpers.js";

const FEMININE = /^(.{2,}?)y?a$/u;
const MASCULINE_OR_OBLIQUE = /^(.{2,}?)y?ê$/u;
const PREPOSITIONS = new Set(["li", "ji", "bi", "di", "bo", "ber"]);

/** A final î shortens before y, so xaniyê comes from xanî. */
const fullStem = (stem: string | undefined) => stem?.replace(/i$/u, "\u00ee");

/** The ezafe follows the noun's gender: bavê min, mala min. */
export const ezafeGender: Rule = {
  id: "kmr.morph.ezafe-gender",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [noun, next] of wordPairs(sentence)) {
        const word = lowered(noun);
        const possessor = lowered(next);
        const possessive = OBLIQUE_TO_DIRECT[possessor] !== undefined;
        const asFeminine = fullStem(FEMININE.exec(word)?.[1]);
        const asMasculine = fullStem(MASCULINE_OR_OBLIQUE.exec(word)?.[1]);
        if (asFeminine && genderOf(asFeminine, context) === "m") {
          if (frequencyOf(word, context) > frequencyOf(asFeminine, context)) continue;
          const fixed = kmr.attach(asFeminine, /[aeêiîouû]$/u.test(asFeminine) ? "yê" : "ê");
          found.push({ start: noun.start, end: noun.end, suggestions: [likeCase(noun.text, fixed)] });
        } else if (asMasculine && possessive && genderOf(asMasculine, context) === "f") {
          // Ez li malê me: after a preposition -ê is the oblique, and me may mean "am".
          const before = sentence.tokens[noun.index - 1];
          if (before?.kind === "word" && PREPOSITIONS.has(lowered(before))) continue;
          // Without a possessor, -ê may simply be the feminine oblique, which is correct.
          const fixed = kmr.attach(asMasculine, /[aeêiîouû]$/u.test(asMasculine) ? "ya" : "a");
          found.push({
            start: noun.start,
            end: noun.end,
            suggestions: [likeCase(noun.text, fixed)],
            confidence: 0.7,
          });
        }
      }
    }
    return found;
  },
};
