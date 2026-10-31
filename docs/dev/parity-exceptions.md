# Parity exceptions

`@zimanyar/core` must behave exactly like [zimankit](https://github.com/0xdolan/zimankit); the parity fixtures exported from zimankit decide. Every intentional difference is listed here with its reason and the test that covers it.

| function | zimankit behaviour | Zimanyar behaviour | reason | test |
| --- | --- | --- | --- | --- |
| `normalizeText`, `ckb.normalize`, `kmr.normalize` | one pass, which is not always stable: `ک + ZWNJ + ب@a.b` gives a text that a second pass changes | repeats the pass until the text stops changing | the plan requires normalisation to be idempotent. The pass itself is exported as `normalizeTextOnce` and `normalizeOnce`, and those match zimankit on every line | `python.test.ts`, `parity-*.test.ts` |
| `tokenize` | offsets count code points | offsets count UTF-16 code units | browsers, editors and the language server all use UTF-16; the tests convert before comparing | `parity-shared.test.ts` |

Scores and distances are compared to six decimal places. `Verb` and the analyzer's `features` hold the same values under the same names, in camelCase where a name is ours.

The analyzers are tested three ways: without a lexicon, on a sample that runs everywhere; with the full lemma table in memory; and reading the compiled lexicon file through `lexiconAdapter`. The last two need `make data` and run in CI's Data job.

## Not in zimankit

Spelling suggestions (`suggest`) and completion (`complete`) are new in Zimanyar. zimankit has the building blocks (`spelling_variants`, `weighted_distance`), but no search over a compiled lexicon, so there is nothing to compare them with. They have their own tests.

## Known issues in zimankit that Zimanyar matches

Parity means matching these until zimankit changes.

- `DERIVATIONS` in `skills_kmr/morphology.py`: a comment on the previous item swallows `geh`, `xane` and `ane`, so they are not recognised as Kurmanji derivational suffixes.
- The published lemma table has an em dash as the present stem of `hebûn`, meaning "no such stem". The data scripts treat it as missing.
- The Kurmanji lexicon holds 70 forms and 4 lemmas in Arabic script, such as `چێشتن`.

## How differences between the languages are handled

These are not exceptions, because the behaviour is the same:

- zimankit's data tables and regular expressions are generated from its source into `packages/core/src/generated/tables.ts`, so they cannot drift or be mistyped. CI regenerates the file and fails if it differs.
- `packages/core/src/python.ts` holds the places where the languages differ: `\s` and `\w`, `str.strip`, `str.count` and `round`.
- `charScript` uses zimankit's answers as generated ranges, because zimankit reads Unicode character names, which JavaScript cannot.
- The Sorani generator treats دا as a preverb that drops the subjunctive ب, giving داخە, but zimankit's own lessons write دابخە. The port matches the generator, and `ckb.verb.preverb-b` follows the lessons by not flagging دابخە.
- The Kurmanji generator gives dijîyî for the 2sg present of jiyan, but zimankit's own lessons write Tu li ku dijî. The port matches the generator, and `kmr.verb.present-agreement` does not judge vowel-final present stems.

## Page names of verbs

zimankit names a verb's reference page by its Latin spelling with marks removed, so *kirin* (to do) and *kirîn* (to buy) both become `kirin.md`, and the second overwrites the first. Here the later verb gets a number: `kirin-2`. Tested in `packages/content/test/tables.test.ts`.

## Kurmanji typed on a Turkish keyboard

zimankit's `identify` is unchanged, and calls *Ez dıçım malê.* Turkish because of the dotless ı. The checker should fix that letter, not fall silent, so `buildParagraph` in `packages/rules` treats a paragraph as Kurmanji when it was identified as Turkish but has letters Turkish lacks (ê, x, w, q) or Kurmanji function words. Tested in `packages/rules/test/run.test.ts`.
