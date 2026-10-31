import { kmr } from "@zimanyar/core";
import { wordPairs } from "../../helpers.js";
import type { RawFinding, Rule, Token } from "../../model.js";
import { likeCase, lowered, OBLIQUE_TO_DIRECT } from "../helpers.js";

/** An intransitive verb has a direct subject, in the past too: Ez hatim. */
export const obliqueIntransitiveSubject: Rule = {
  id: "kmr.verb.oblique-intransitive-subject",
  check({ sentences }) {
    const index = kmr.defaultIndex();
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [subject, verb] of wordPairs(sentence)) {
        // Only at the start of a sentence: after a noun, min is a possessor, as in bavê min hat.
        if (subject !== (sentence.words[0] as Token)) continue;
        const direct = OBLIQUE_TO_DIRECT[lowered(subject)];
        if (direct === undefined) continue;
        const isIntransitive = index.lookup(lowered(verb)).some((form) => {
          const transitive = index.verbs.get(form.lemma)?.transitive;
          // Wê bê is the future with the particle wê, so only the tenses count.
          return transitive === false && form.features["tense"] !== undefined;
        });
        if (isIntransitive)
          found.push({
            start: subject.start,
            end: subject.end,
            suggestions: [likeCase(subject.text, direct)],
          });
      }
    }
    return found;
  },
};
