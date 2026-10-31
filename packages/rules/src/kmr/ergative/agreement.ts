import { kmr } from "@zimanyar/core";
import type { RawFinding, Rule } from "../../model.js";
import { DIRECT_PERSONS, likeCase, reinflect } from "../helpers.js";

/** In the past of a transitive verb, the verb agrees with the object: Min tu dîtî. */
export const ergativeAgreement: Rule = {
  id: "kmr.ergative.agreement",
  check({ sentences, text }, context) {
    const found: RawFinding[] = [];
    for (const sentence of sentences) {
      const record = kmr.detectAlignment(text.slice(sentence.start, sentence.end), context.analyzer);
      const { agent, object, verb, lemma, verbPerson } = record;
      if (record.alignment !== "ergative" || record.agreementOk !== false) continue;
      if (agent === null || object === null || verb === null || lemma === null || verbPerson === null)
        continue;
      // A bare noun may be singular or plural: Min sêv xwarin is correct. Only a pronoun proves it.
      const persons = DIRECT_PERSONS[object.token.toLowerCase()];
      if (persons === undefined) continue;
      const token = sentence.words.find((word) => word.text === verb);
      if (token === undefined) continue;
      const source = kmr
        .defaultIndex()
        .lookup(verb.toLowerCase())
        .find((form) => form.features["person"] === verbPerson);
      const fixes = persons.flatMap((person) => {
        const fixed = reinflect(lemma, (features) => {
          const keys = new Set([...Object.keys(features), ...Object.keys(source?.features ?? {})]);
          return [...keys].every((key) =>
            key === "person" ? features[key] === person : features[key] === source?.features[key],
          );
        });
        return fixed === null ? [] : [likeCase(verb, fixed)];
      });
      found.push({
        start: token.start,
        end: token.end,
        suggestions: fixes,
        params: { object: object.token },
      });
    }
    return found;
  },
};
