import { kmr } from "@zimanyar/core";
import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { likeCase, lowered } from "../helpers.js";

/** A verb with a preverb has no bi- in the subjunctive or imperative: rabe. */
export const preverbBi: Rule = {
  id: "kmr.verb.preverb-bi",
  check({ sentences }) {
    const index = kmr.defaultIndex();
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const text = lowered(word);
      if (!text.startsWith("bi") || index.lookup(text).length > 0) continue;
      const candidate = text.slice(2);
      const isTarget = index.lookup(candidate).some((form) => {
        const hasPreverb = Boolean(index.verbs.get(form.lemma)?.preverb);
        const mood = form.features["mood"];
        return hasPreverb && (mood === "subjunctive" || mood === "imperative");
      });
      if (isTarget)
        found.push({ start: word.start, end: word.end, suggestions: [likeCase(word.text, candidate)] });
    }
    return found;
  },
};
