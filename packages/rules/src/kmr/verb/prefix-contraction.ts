import { kmr } from "@zimanyar/core";
import { allWords } from "../../helpers.js";
import type { RawFinding, Rule } from "../../model.js";
import { likeCase, lowered } from "../helpers.js";

/** The prefix, the first letter of the stem, and what they contract to. */
const CONTRACTIONS: readonly (readonly [string, RegExp, string])[] = [
  ["di", /^[êî]/u, "t"],
  ["na", /^[êî]/u, "nay"],
  ["bi", /^[êî]/u, "b"],
  ["ne", /^[êî]/u, "ney"],
  ["na", /^a/u, "n"],
  ["bi", /^a/u, "b"],
];

/** Prefixes contract with stems that start in ê, î or a: têm, nayêm, bêm, naxivim. */
export const prefixContraction: Rule = {
  id: "kmr.verb.prefix-contraction",
  check({ sentences }) {
    const index = kmr.defaultIndex();
    const found: RawFinding[] = [];
    for (const word of allWords(sentences)) {
      const text = lowered(word);
      if (index.lookup(text).length > 0) continue;
      for (const [prefix, stem, contracted] of CONTRACTIONS) {
        const rest = text.slice(prefix.length);
        if (!text.startsWith(prefix) || !stem.test(rest)) continue;
        const candidate = contracted + rest;
        if (index.lookup(candidate).length > 0) {
          found.push({ start: word.start, end: word.end, suggestions: [likeCase(word.text, candidate)] });
          break;
        }
      }
    }
    return found;
  },
};
