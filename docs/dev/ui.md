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

## The editor

`attachEditor(element, options)` from `@zimanyar/editor` puts underlines, the finding card, a count badge and autocomplete on a `textarea`, a text `input` or a `contenteditable` element. It returns null for a field it may not read, such as a password or a card number. `CheckerClient` from `@zimanyar/checker` fits its `backend` option, so all checking happens in a worker.

- **Nothing in the page changes** except the text, and the field's `spellcheck` attribute: the browser's spellchecker knows no Kurdish and would underline every word a second time. It is restored on `destroy()`. Everything drawn sits in one closed shadow root per field.
- **Styles.** Pass the stylesheet of `@zimanyar/ui` as text in `css`. In a shadow root `:root` matches nothing and `@font-face` and `@property` do nothing, so `splitStyles` rewrites the first and moves the other two into the document.
- **A textarea** does not say where its text is drawn, so a hidden copy with the same styles and width is measured. A browser test holds underlines in a textarea to within 2 px of the same text in a `contenteditable` element.
- **Replacing text** uses the browser's own editing command, which keeps undo and lets page scripts hear about the change. If that does nothing, the value is set directly and an `input` event fired.
- **While typing**, checks leave out spelling suggestions, the slowest step. A finding's `lookup` names the word, and the suggestions are fetched when its card opens. Underlines move with an edit straight away, and nothing is checked during IME composition.

| key | where | does |
| --- | --- | --- |
| Alt+Enter | text | opens the finding at the caret, or the next one, and moves focus to its card |
| Esc | text or card | closes the card; from the card, focus returns to the text |
| Down, Up | text, words showing | moves through the words |
| Tab | text, words showing | takes the chosen word, or the first |
| Enter | text, words showing | takes a word only once one has been chosen; otherwise it ends the line |

An `aria-activedescendant` id cannot point across a shadow root, so the word in focus is announced through a live region.

## Browser tests and screenshots

`packages/ui/demo` is a page of the components with real findings, and `packages/editor/demo` is the editor on real fields. `make e2e` builds it and tests it in a real browser with a throwaway profile, in each language and theme: axe accessibility checks with colour contrast, no sideways scrolling at 320 px, right-to-left layout, the keyboard, and no outside requests.

`make screenshots` also regenerates `assets/screenshots/`. Look at every changed image, and commit them with the change.
