---
name: zimanyar-add-rule
description: Add or change a Zimanyar checking rule (ckb, kmr or cross-language) with metadata in three languages, implementation, 20+ tests, examples, lesson links, gold corpus entries and the regenerated catalogue. Use whenever a task creates, renames or changes the behaviour of a rule in packages/rules.
---

# Adding a rule

A rule is a pure function over the document model that returns findings. Each rule is
explainable: every finding says what is wrong, why, how to fix it and where to learn more.

## Files

```
packages/rules/src/<lang>/<family>/<rule>.ts          implementation
packages/rules/src/<lang>/<family>/<rule>.meta.yaml   metadata
packages/rules/src/<lang>/<family>/<rule>.test.ts     tests
corpus/<lang>/*.jsonl                                 gold corpus entries
```

`<lang>` is `ckb`, `kmr` or `any`; `<family>` is `orth`, `spell`, `morph`, `verb`,
`ergative`, `syntax`, `lid`, `script`, `space` or `repeat`. The rule id is
`<lang>.<family>.<rule>`, for example `ckb.morph.definite-allomorph`.

## Steps

1. **Ground the rule in zimankit.** Find the validator, analyzer, paradigm or tutorial
   "common errors" section that defines the behaviour. Do not invent grammar. If zimankit
   and the tutorials disagree, stop and ask the maintainer.
2. **Metadata** (`<rule>.meta.yaml`): `id`, `family`, `category`, `severity`, `confidence`,
   `safeFix`, `message` and `reason` in `en`, `ckb` and `kmr`, at least two `examples`
   (`wrong`, `right`, optional `gloss`), and `lessons` (primary first, then related; each
   `lang`, `lessonId`, `anchor`). Messages are plain text with ICU parameters, never HTML.
3. **Implementation.** Pure, deterministic, no DOM or Node APIs. Work on tokens and cached
   analyses; never re-analyse text the document model already analysed. Return nothing when
   evidence is missing: unknown words, pro-drop subjects and agents, and (kmr) bare direct
   plurals must not produce findings. Declare the confidence; let the runner filter.
4. **Suppression.** If the rule explains a span better than an earlier family (for example a
   morphology rule over a spelling finding), declare it so the runner drops the weaker one.
5. **Tests** (at least 20): 10 or more positive cases, 10 or more negative cases (correct
   text that looks similar, colloquial forms in Tolerant mode, names, mixed script), every
   metadata example, and the fix applied: applying a safe fix must not create a new finding
   of the same rule.
6. **Gold corpus.** Add sentences with and without the error to `corpus/<lang>/`, annotated
   with rule id, span and suggestion.
7. **Catalogue.** Regenerate the rule pages and check the lesson pages list the rule.
8. **Strings.** All three catalogues; run `make lint` (dashes, Kurdish spelling, i18n).

## Before you finish

- [ ] `make test` and `make lint` pass
- [ ] Precision on the gold corpus meets the family target (orthography 0.98, others 0.90)
- [ ] No em or en dashes in messages; "Kurdish" is کوردی in Arabic script
