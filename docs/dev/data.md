# The data pipeline

Zimanyar's lexicon comes from [zimankit](https://github.com/0xdolan/zimankit). Python only downloads, verifies and exports it; TypeScript compiles it.

```sh
make data
```

| step | does | writes |
| --- | --- | --- |
| `scripts/data/fetch_bundle.py` | downloads the release asset, checks its SHA-256 against `packages/data/VERSION`, unpacks it, checks each file against the bundle's manifest | `build/bundle/` |
| `scripts/data/export_lexicon.py` | keeps the columns the checker uses, as sorted TSV; copies the rules and tables | `build/raw/`, `rules/`, `tables/`, `NOTICE` |
| `scripts/data/export_core_tables.py` | copies zimankit's data tables and regular expressions into TypeScript | `packages/core/src/generated/tables.ts` |
| `scripts/data/export_fixtures.py` | runs zimankit on many inputs and records the outputs | `build/fixtures/`, `fixtures/` |
| `scripts/data/build-lexicon.ts` | compiles one file per language; fails over 6 MB | `build/lexicon-<lang>.bin.gz`, `lexicon.lock.json` |

Paths are under `packages/data/`. `build/` is git-ignored. `make build` skips the compile when `make data` has not run, so working on anything else needs no download.

## Pinning

`packages/data/VERSION` names the zimankit version, the bundle and its SHA-256. `pyproject.toml` pins the same zimankit from PyPI: PyPI has the code the fixtures run, and the GitHub release has the data. The two must agree, and `export_fixtures.py` stops if they do not.

To move to a new version: change both, run `make data`, and commit what changes. CI's data job rebuilds everything and fails if the result differs from what is committed. That includes `lexicon.lock.json`, the checksums of the compiled lexicons, so it also proves that another machine gets the same bytes.

## The lexicon format

One file per language, gzipped, read by `Lexicon` in `packages/data/src/lexicon.ts`:

```
"ZMLX"  format version  header length  JSON header  sections
```

The header holds the versions, the shared tables and where each section is. The forms and lemmas are each a minimal acyclic automaton. Words in such an automaton have a rank, their position in sorted order, and that rank is the index into plain columns:

| section | one entry per | holds |
| --- | --- | --- |
| `formArcs`, `formAlphabet` | | the automaton of surface forms |
| `formLemma` | form | rank of its lemma |
| `formFeatures` | form | index of its part of speech and features in the header's table |
| `formMeta` | form | frequency (5 bits), quality tier (2), attested (1) |
| `lemmaArcs`, `lemmaAlphabet` | | the automaton of lemmas |
| `lemmaAttributes` | lemma | index of its part of speech, gender and transitivity |
| `lemmaMeta` | lemma | frequency |
| `variantArcs`, `variantAlphabet`, `variantTargets` | variant | non-standard spellings and the rank of the standard form |

Because a form's data is found by rank, no form stores a pointer, which is most of why 500 000 forms fit in under 2 MB. Stems and cross references, which few lemmas have, are in the header.

Definitions, IPA and segmentation are left out. IPA and segmentation are computed by the engine, and definitions would multiply the size.

Everything is checked on load: section bounds, arc order and targets, column lengths, and every index into a table. A damaged file is refused, never read past its end. This is tested with damaged files in `packages/data/test/lexicon.test.ts`.

## Fixtures

`export_fixtures.py` records zimankit's behaviour so that `@zimanyar/core` can be proven to match it. The full set is written to `build/fixtures/`, and a small sample of each to `fixtures/`, which is committed so parity tests run without a download. `readFixture` returns the full set when it exists.

| fixture | lines | content |
| --- | --- | --- |
| `<lang>_orthography` | 50 000 | normalisation and validation of frequent words and 5 000 corrupted ones |
| `<lang>_phonology` | 20 000 | IPA, syllables, segments, the other script |
| `<lang>_verbs` | core verbs + 500 | full paradigms |
| `<lang>_decline` | 2 000 | noun declension (Kurmanji with gender) |
| `<lang>_analyze` | 30 000 | the top three analyzer readings |
| `kmr_alignment` | 2 000 | the ergativity checker |
| `shared_text` | 2 000 | normalisation, tokens with offsets, sentences |
| `shared_distance` | 2 000 | edit distances |
| `shared_lid` | 5 000 | language identification |

Scores are rounded to six places. zimankit's corpus is private, so sentences and paragraphs are built from the public lexicon, plus short samples for the languages that must be left alone. They test that the port behaves like zimankit, not how accurate language identification is: that belongs to the gold corpus.

## Licence

The data is CC BY-SA 4.0 and is separate from the GPL-3.0-or-later code: see `NOTICE`.
