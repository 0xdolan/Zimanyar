import { kmr } from "@zimanyar/core";
import type { RawFinding, Rule, Token } from "../../model.js";
import { DIRECT_PERSONS, likeCase, lowered, presentForm, reinflect } from "../helpers.js";

/** A present verb agrees with its subject: Ez diçim. */
export const presentAgreement: Rule = {
  id: "kmr.verb.present-agreement",
  check({ sentences }) {
    const found: RawFinding[] = [];
    for (const { words } of sentences) {
      const subject = words[0] as Token | undefined;
      const verb = words.at(-1);
      if (subject === undefined || verb === undefined || subject === verb) continue;
      const persons = DIRECT_PERSONS[lowered(subject)];
      const form = presentForm(lowered(verb));
      if (persons === undefined || form === null) continue;
      // After a vowel-final stem the lessons write the 2sg like the 3sg: Tu li ku dijî?
      const stem = kmr.defaultIndex().verbs.get(form.lemma)?.present ?? "";
      if (/[aeêiîouû]$/u.test(stem)) continue;
      const own = form.features["person"] as string;
      if (persons.includes(own)) continue;
      const fixes = persons.flatMap((person) => {
        const fixed = reinflect(
          form.lemma,
          (f) =>
            f["tense"] === "present" &&
            f["mood"] === "indicative" &&
            f["person"] === person &&
            f["polarity"] === form.features["polarity"],
        );
        return fixed === null ? [] : [likeCase(verb.text, fixed)];
      });
      found.push({ start: verb.start, end: verb.end, suggestions: fixes });
    }
    return found;
  },
};
