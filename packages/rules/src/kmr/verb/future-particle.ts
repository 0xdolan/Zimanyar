import { wordPairs } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { likeCase, lowered, presentForm, reinflect } from "../helpers.js";

const FUTURE = new Set(["ê", "dê"]);

/** After the future particle the verb is subjunctive: Ez ê biçim. */
export const futureParticle: Rule = {
  id: "kmr.verb.future-particle",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      for (const [particle, verb] of wordPairs(sentence)) {
        if (!FUTURE.has(lowered(particle))) continue;
        const form = presentForm(lowered(verb));
        if (form === null) continue;
        const fixed = reinflect(
          form.lemma,
          (f) =>
            f["mood"] === "subjunctive" &&
            f["person"] === form.features["person"] &&
            f["polarity"] === form.features["polarity"],
        );
        if (fixed !== null)
          found.push({ start: verb.start, end: verb.end, suggestions: [likeCase(verb.text, fixed)] });
      }
    }
    return found;
  },
};
