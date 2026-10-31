import type { Lexicon } from "@zimanyar/data";
import type { Variety } from "../src/index.js";
import { makeLexicon, nouns } from "./helpers.js";

/** The words the rules' examples use. Real checking uses the full lexicon. */
export const LEXICONS: Record<Variety, Lexicon> = {
  ckb: makeLexicon("ckb", nouns([["کتێب"]])),
  kmr: makeLexicon("kmr", nouns([["kitêb", "f"]])),
};
