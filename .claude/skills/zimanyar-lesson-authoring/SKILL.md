---
name: zimanyar-lesson-authoring
description: Write or import Zimanyar lessons (Sorani and Kurmanji) as MDX with stable anchors, levels, live tables rendered by @zimanyar/core and examples the checker must accept. Use for any work in packages/content/lessons or the tutorial importer.
---

# Lesson authoring

Lessons come from zimankit's `docs/tutorials/` (23 per variety, plus cheat sheets, verb pages,
noun tables and vocabularies) and live as MDX in `packages/content/lessons/<lang>/`.

## Structure

- Frontmatter: `title` (in the lesson's language and English), `lang`, `lesson` (1 to 23),
  `level` (beginner 1 to 10, intermediate 11 to 17, advanced 18 to 23), `rules` (ids of the rules
  the lesson teaches).
- Headings keep zimankit's anchors exactly: finding cards and rule pages link to them. Never
  rename a heading without adding the old anchor back.
- zimankit's `<!-- gen:... -->` blocks become live components: `<VerbTable>`, `<NounTable>`,
  `<Analyze>`, `<Sentences>`, `<Ergativity>`. They render from `@zimanyar/core`, so the tables
  are computed by the same engine that checks text. Do not paste static tables.
- Kurdish text is wrapped with the correct `dir` and `lang` (`ckb` RTL, `kmr` LTR).

## Examples

- Keep zimankit's examples and add at least five more checked sentences per section.
- Every example sentence is checked in CI: it must produce no findings, or exactly the finding
  it is annotated with (for "common errors" sections).
- Examples are real Kurdish. Do not invent forms; generate paradigms with the engine.

## Writing rules

- No em or en dashes. "Kurdish" in Arabic script is کوردی, Kurdistan is کوردستان.
- Kurdish is an Indo-European language in its own right; never call it "Iranian".
- Regions: Başûr, Rojhilat, Bakur, Rojava.
- Each lesson lists the rules it teaches ("Zimanyar checks this") and links related lessons.
