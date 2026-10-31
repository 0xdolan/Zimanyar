import type { Lexicon } from "@zimanyar/data";
import type { LemmaRow } from "@zimanyar/data/builder";
import type { Variety } from "../src/index.js";
import { makeLexicon, nouns } from "./helpers.js";

const rows = (upos: string, words: string, zipf = 4): LemmaRow[] =>
  words.split(" ").map((lemma) => ({ lemma, upos, zipf, count: 1000 }));

/** The words the rules' tests and examples use. Real checking uses the full lexicon. */
export const LEXICONS: Record<Variety, Lexicon> = {
  ckb: makeLexicon(
    "ckb",
    [
      ...rows(
        "NOUN",
        "کتێب پیاو نان دەرگا ماڵ کوڕ کچ ژن ئاو چای ماسی چیا ئەسپ ڕۆژ وێستگە سێشەممە دێر سەورە سەد قەڵەم",
      ),
      ...rows("NOUN", "گوڵ", 6),
      ...rows("NOUN", "گول مال دیر کور تو هەرەس", 1),
      ...rows("PRON", "تۆ", 6),
      ...rows("NOUN", "هەڕەس", 6),
      ...rows("ADJ", "باش جوان گەورە بچووک نوێ کۆن"),
      ...rows("CCONJ", "بەڵام", 6),
      ...rows("PRON", "هیچ"),
      ...rows("NOUN", "ژیان هەندێک هیچی مێز"),
      ...rows("VERB", "خواردن کردن هاتن چوون"),
      ...[{ lemma: "کوڕ", upos: "NOUN", zipf: 6, count: 1 }].slice(1),
    ],
    [
      { variant: "بەلام", standard: "بەڵام" },
      { variant: "سێشەمە", standard: "سێشەممە" },
      { variant: "ڕای\u200cگەیاند", standard: "ڕایگەیاند" },
      { variant: "وێستگە\u200cیە", standard: "وێستگەیە" },
      { variant: "دیناره", standard: "دینارە" },
      { variant: "نێردراوه", standard: "نێردراوە" },
    ],
    [
      "ڕایگەیاند",
      "وێستگەیە",
      "دینارە",
      "نێردراوە",
      "پیاوەکە",
      "دەرگاکە",
      "کتێبەکەم",
      "نانەکە",
      "کوڕێک",
      "پیاوێک",
    ],
  ),
  kmr: makeLexicon("kmr", nouns([["kitêb", "f"]])),
};
