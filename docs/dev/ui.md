# The interface

## Strings

Every string goes through `t()` from `@zimanyar/i18n`, with entries in `en`, `ckb` and `kmr`. `{name}` inserts a value as plain text, and `{count, plural, one {...} other {...}}` chooses by number. `make check-i18n` fails on a missing translation, a key code uses that does not exist, and a key nothing uses.

A rule's own messages live in its metadata, in `@zimanyar/rules`.

## Components

`packages/ui` holds shadcn components in `src/components/ui/` and our own beside them. The shadcn files stay close to upstream, with two changes the CLI cannot make for us: imports use relative paths, and physical properties such as `pl-` and `pr-` become logical ones such as `ps-` and `pe-`, so that they work right to left. Check for those after adding a component.

| component | use |
| --- | --- |
| `FindingCard` | one finding: compact beside the text, expanded in a panel |
| `FindingsPanel` | every finding in a text, grouped by category |
| `AutocompleteList` | word suggestions; the text field keeps focus and the keyboard |
| `BidiText` | text that may mix scripts, each run isolated with its own direction |

Text is only ever rendered as text nodes. Fonts are bundled from `@fontsource`, so nothing is fetched from elsewhere, which a browser test checks.

Wrong examples are not struck through: a line through Arabic script cuts through the marks that tell ڕ from ر, which are often the very mistake. The column heading says which is wrong, so colour does not carry it alone.

Lesson titles exist only in English so far, so the Sorani and Kurmanji interfaces name lessons by number.

## Browser tests and screenshots

`packages/ui/demo` is a page of the components with real findings. `make e2e` builds it and tests it in a real browser with a throwaway profile, in each language and theme: axe accessibility checks with colour contrast, no sideways scrolling at 320 px, right-to-left layout, the keyboard, and no outside requests.

`make screenshots` also regenerates `assets/screenshots/`. Look at every changed image, and commit them with the change.
