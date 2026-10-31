import type { Lexicon } from "@zimanyar/data";
import type { LexiconLike } from "./schema.js";

/** Give the analyzers the compiled lexicon. They ask about lemmas, many times per token. */
export function lexiconAdapter(lexicon: Lexicon): LexiconLike {
  const lemmas = lexicon.lemmaAutomaton;
  const posSets = new Map<string, ReadonlySet<string>>();
  const none: ReadonlySet<string> = new Set();
  return {
    has: (word) => lemmas.has(word),
    posOf(word) {
      const rank = lemmas.rank(word);
      if (rank < 0) return none;
      const { upos } = lexicon.lemmaAttributesAt(rank);
      let set = posSets.get(upos);
      if (set === undefined) {
        set = new Set([upos]);
        posSets.set(upos, set);
      }
      return set;
    },
    freq(word) {
      const rank = lemmas.rank(word);
      return rank < 0 ? 0 : lexicon.lemmaCountAt(rank);
    },
    genderOf(word) {
      const rank = lemmas.rank(word);
      return rank < 0 ? null : (lexicon.lemmaAttributesAt(rank).gender ?? null);
    },
  };
}
