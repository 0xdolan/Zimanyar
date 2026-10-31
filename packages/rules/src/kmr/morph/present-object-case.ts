import { kmr } from "@zimanyar/core";
import type { RawFinding, Rule, Token } from "../../model.js";
import { DIRECT_PERSONS, genderOf, isBareNoun, lowered, presentForm } from "../helpers.js";

/** A definite object of a present verb is oblique. It may be indefinite, so this is only a hint. */
export const presentObjectCase: Rule = {
  id: "kmr.morph.present-object-case",
  check({ sentences }, context) {
    if (context.lexicon === null) return [];
    const found: RawFinding[] = [];
    for (const { tokens } of sentences) {
      for (let i = 0; i + 2 < tokens.length; i++) {
        const [subject, object, verb] = [tokens[i], tokens[i + 1], tokens[i + 2]] as [Token, Token, Token];
        if (DIRECT_PERSONS[lowered(subject)] === undefined) continue;
        const word = lowered(object);
        // A language name such as kurdî takes no ending.
        if (word.endsWith("\u00ee")) continue;
        if (!isBareNoun(word, context) || genderOf(word, context) !== "f") continue;
        const form = presentForm(lowered(verb));
        const transitive = form && kmr.defaultIndex().verbs.get(form.lemma)?.transitive;
        const oblique = kmr.decline(word, "f").find(([cell]) => cell === "def.obl.sg")?.[1];
        if (transitive && oblique)
          found.push({ start: object.start, end: object.end, suggestions: [oblique] });
      }
    }
    return found;
  },
};
