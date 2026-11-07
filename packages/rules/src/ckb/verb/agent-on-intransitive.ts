import { ckb } from "@zimanyar/core";
import { allWords, isLemma } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";

const SET1: Readonly<Record<string, string>> = {
  مان: "ین",
  تان: "ن",
  یان: "ن",
};
const PREFIX = /^(نەدە|نە|دە)?(.+)$/u;

let intransitivePasts: ReadonlySet<string> | undefined;
function pasts(): ReadonlySet<string> {
  intransitivePasts ??= new Set(
    ckb
      .loadCoreVerbs()
      .filter((verb) => !verb.transitive && !verb.preverb)
      .map((verb) => verb.past),
  );
  return intransitivePasts;
}

/** Clitics mark the agent of a transitive verb. An intransitive verb takes verb endings. */
export const agentOnIntransitive: Rule = {
  id: "ckb.verb.agent-on-intransitive",
  check({ sentences }, context) {
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      if (ckb.defaultIndex().lookup(word.text).length > 0 || isLemma(word.text, context)) continue;
      for (const [clitic, ending] of Object.entries(SET1)) {
        if (!word.text.endsWith(clitic)) continue;
        const [, prefix = "", past = ""] = PREFIX.exec(word.text.slice(0, -clitic.length)) ?? [];
        if (pasts().has(past)) {
          found.push({ start: word.start, end: word.end, suggestions: [prefix + past + ending] });
          break;
        }
      }
    }
    return found;
  },
};
