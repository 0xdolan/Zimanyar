# Rules

A rule is a pure function from a paragraph to raw findings. Everything else about a finding (message, reason, severity, examples, lessons) comes from its metadata.

```
packages/rules/src/<lang>/<family>/<rule>.ts          the check
packages/rules/src/<lang>/<family>/<rule>.meta.yaml   id, severity, confidence, messages in en, ckb, kmr, examples, lessons
packages/rules/src/<lang>/<family>/<rule>.test.ts     at least 10 cases it finds and 10 it must leave alone
```

Then add the rule to `registry.ts`, run `make rules` to compile the metadata, and add sentences to `corpus/<lang>/`.

`packages/rules/test/catalogue.test.ts` holds every rule to this: messages in three languages, at least two examples and a lesson link that exists, each example's wrong form found and fixed, and its right form left alone.

## How a check runs

`Checker` splits text into paragraphs and checks only those that changed. Each paragraph gets a language and a list of sentences (`buildParagraph`). A paragraph in another language gets a neutral notice and nothing else; otherwise language identification below 0.6 falls back to the script and lowers every finding's confidence by 0.2.

Findings under the mode's threshold are hidden: 0.4 in Standard and 0.6 in Tolerant. Rules marked `standardOnly` do not run in Tolerant. A spelling finding is dropped when another finding overlaps it, because that one explains the word better.

The document model lives in `@zimanyar/rules`, not `@zimanyar/checker`, so that rules and their tests can use it without depending on the layer above them.

## Rules that need the lexicon

A rule that needs the lexicon finds nothing without it, so a page works before the lexicon has loaded. Rule tests use a small lexicon of the words they mention. The Data job measures all of them with the real lexicons on the [gold corpus](../../corpus/README.md).

## Lessons

Metadata links to lessons by number and heading anchor. `packages/rules/lessons.json` is the index of what exists, generated from a zimankit checkout by `scripts/content/export-lesson-index.ts`.
