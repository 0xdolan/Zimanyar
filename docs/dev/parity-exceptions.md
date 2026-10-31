# Parity exceptions

`@zimanyar/core` must behave exactly like [zimankit](https://github.com/0xdolan/zimankit); the parity fixtures exported from zimankit decide. Every intentional difference is listed here with its reason and the test that covers it.

| function | zimankit behaviour | Zimanyar behaviour | reason | test |
| --- | --- | --- | --- | --- |
| `tokenize` | offsets count code points | offsets count UTF-16 code units | browsers, editors and the language server all use UTF-16; the tests convert before comparing | `parity-shared.test.ts` |

Scores and distances are compared to six decimal places. `Verb` and the analyzer's `features` hold the same values under the same names, in camelCase where a name is ours.

The analyzers are tested two ways: without a lexicon, on a sample that runs everywhere, and with the full lemma table, which needs `make data` and runs in CI's Data job.

## How differences between the languages are handled

These are not exceptions, because the behaviour is the same:

- zimankit's data tables and regular expressions are generated from its source into `packages/core/src/generated/tables.ts`, so they cannot drift or be mistyped. CI regenerates the file and fails if it differs.
- `packages/core/src/python.ts` holds the places where the languages differ: `\s` and `\w`, `str.strip`, `str.count` and `round`.
- `charScript` uses zimankit's answers as generated ranges, because zimankit reads Unicode character names, which JavaScript cannot.
