<div align="center">
  <img src="assets/icons/png/logo-256.png" alt="Zimanyar logo" width="128">

# Zimanyar

**The offline grammar checker and teacher for Kurdish.**

زمانیار · Zimanyar · *language helper* in Kurdish

[![Status: in development](https://img.shields.io/badge/status-in%20development-febd11)](#status)
[![Sorani and Kurmanji](https://img.shields.io/badge/languages-Sorani%20%C2%B7%20Kurmanji-1d4a2e)](#what-it-checks)
[![Offline](https://img.shields.io/badge/checking-100%25%20offline-1d4a2e)](#private-by-design)
[![Built on zimankit](https://img.shields.io/badge/built%20on-zimankit-4a86cf)](https://github.com/0xdolan/zimankit)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

[What it checks](#what-it-checks) · [Surfaces](#where-it-runs) · [How it works](#how-it-works) · [The name and the logo](docs/STORY.md) · [Brand](assets/brand/README.md) · [zimankit](https://github.com/0xdolan/zimankit)

<img src="assets/marketing/banner.png" alt="Zimanyar: write Kurdish with confidence" width="100%">
</div>

Zimanyar finds mistakes in **Sorani** (`ckb`) and **Kurmanji** (`kmr`), explains why they are wrong, fixes them in one click, and teaches the grammar behind every fix. It understands what makes Kurdish Kurdish: the ezafe, definite endings, personal clitics, and the split ergativity that makes the past tense work differently from the present. Everything runs on your device: no account, no cloud, no tracking.

The name joins *ziman*, language, and *yar*, friend and helper; the logo joins the crown of *deq*, the traditional Kurdish tattoo, with Roj, the sun of the flag of Kurdistan. [Read the story and its sources](docs/STORY.md).

## Status

Zimanyar **1.0.0** is out. The browser extension, the Linux desktop app, the command line and the language server are on the [releases page](https://github.com/0xdolan/Zimanyar/releases), with checksums, a signature and build provenance for every file (see [RELEASING.md](RELEASING.md)); the Chrome Web Store and Firefox Add-ons listings follow once the stores have reviewed them. The interface in every image here is a real screenshot of the built apps, taken by Playwright (`make screenshots`).

## Features

- **Checks as you type.** Spelling, orthography, morphology and agreement mistakes are underlined in any text field: web pages, the popup, the desktop app or a terminal.
- **Explains why, not just what.** Every finding says what is wrong and why, gives the correct form with its pronunciation in IPA, and shows wrong and right examples.
- **Teaches the rule.** Every finding links to the lesson that teaches it: 46 lessons, 23 for each variety, from the alphabet to ergativity.
- **Fixes legacy text.** Arabic and Persian letters typed for Kurdish ones (ك ي ة, ه for ە), missing marks (ڕ ڵ ێ ۆ), and Turkish letters in Kurmanji (ı İ ğ) are found and fixed, safely and in bulk.
- **Autocomplete that knows Kurdish.** Suggestions come from an 830 000-form lexicon with full verb paradigms, ranked by frequency, with helpers for ê î û ş ç.
- **Knows what is not Sorani or Kurmanji.** Zazaki, Gorani, Persian, Arabic, Turkish and English text is recognised and left alone.
- **Three interface languages.** English, کوردی سۆرانی and Kurmancî, with full right-to-left layout.
- **Private by design.** No text ever leaves your device. The checker makes no network requests, and a test fails the build if it ever does.

## A look at Zimanyar

| Underlines mistakes as you type · Sorani | Explains why, not just what · Kurmanji |
| --- | --- |
| <img src="assets/marketing/store/screenshot-1-check-sorani.png" alt="Underlines mistakes as you type"> | <img src="assets/marketing/store/screenshot-2-explain-kurmanji.png" alt="Explains why, not just what"> |

| Learn the rule behind the fix | Everywhere you write |
| --- | --- |
| <img src="assets/marketing/store/screenshot-3-learn.png" alt="Learn the rule behind the fix"> | <img src="assets/marketing/store/screenshot-4-everywhere.png" alt="Everywhere you write"> |

| The website checker, in a Sorani interface | Practice: drills and lessons for your frequent mistakes |
| --- | --- |
| <img src="assets/screenshots/web-check-ckb.png" alt="The website checker with Sorani findings and a right-to-left interface"> | <img src="assets/screenshots/desktop-practice.png" alt="The Practice tab of the desktop app"> |

| Verb forms from the engine | On a phone |
| --- | --- |
| <img src="assets/screenshots/extension-verbs.png" alt="The verb explorer"> | <img src="assets/screenshots/web-check-phone.png" alt="The website checker on a phone" width="260"> |

## What it checks

A few rules from the catalogue:

| Variety | Mistake | Correction | Why |
| --- | --- | --- | --- |
| Sorani | دەرگاەکە | **دەرگاکە** | after a vowel, "the" is ـکە |
| Sorani | من نان خواردم | **من نانم خوارد** | in the past, the agent clitic goes on the object |
| Sorani | وێستگه | **وێستگە** | legacy encoding: ه used for the vowel ە |
| Kurmanji | Min tu dîtim. | **Min tu dîtî.** | in the past, a transitive verb agrees with the object |
| Kurmanji | li mal | **li malê** | the noun after a preposition is oblique |
| Kurmanji | dıçım | **diçim** | ı is a Turkish letter |

Every rule has an explanation, at least two wrong and right examples and a lesson link, and is measured for precision and recall on a hand-annotated corpus of real mistakes, so Zimanyar does not drown you in false alarms. A **Tolerant** mode accepts common colloquial forms for writers who do not want the written standard enforced.

## Where it runs

All surfaces share one engine, one rule set and one interface.

| Surface | What you get | Channel |
| --- | --- | --- |
| Chrome, Edge, Brave | in-page checking, popup, settings, side panel | Chrome Web Store |
| Firefox | in-page checking, popup, settings, sidebar | Firefox Add-ons |
| Safari | the same extension, not tested | Xcode project in the GitHub releases |
| Linux desktop | editor, lessons, tools; a global shortcut checks the clipboard | `.deb`, `.rpm`, AppImage, Ubuntu PPA |
| Command line | `zimanyar check`, with text, JSON and SARIF output for CI, and the word tools and lessons | npm, `.deb`, a single executable |
| Editors | diagnostics, quick fixes, hovers and completion over LSP | `zimanyar-lsp` |
| Web | a live checker, the lessons and the rule catalogue | <https://0xdolan.github.io/Zimanyar/> |

The extension asks for the fewest permissions it can: it runs only on the sites you turn it on for, and never loads remote code.

## Plans

- Checking for Southern Kurdish, Zazaki and Gorani, once open data for them is available. Until then they are recognised and left alone.

Not planned: an extension for VS Code (the language server works with any editor that has an LSP client), an App Store listing for Safari, and checking inside editors that draw their own text, such as Google Docs (use the desktop app or the web checker there).

## How it works

Zimanyar is a TypeScript port of [zimankit](https://github.com/0xdolan/zimankit), the Kurdish linguistic toolkit: normalisation, tokenisation, language identification, IPA, transliteration, morphology, verb paradigms and the split-ergativity checker. Tens of thousands of input and output pairs exported from zimankit are replayed against the port in CI, and any difference fails the build.

```
@zimanyar/data       lexicon automata and rule data, built from the zimankit bundle
@zimanyar/core       the port of zimankit: normalise, tokenise, identify, phonology, morphology, verbs
@zimanyar/rules      rule implementations, explanations, examples and lesson links
@zimanyar/checker    document model, rule runner, incremental cache, worker entry
apps/                web (Astro), extension (WXT), desktop (Tauri), cli, lsp
```

The checker runs in a worker, so typing never waits for it. Only changed paragraphs are checked again, and each language's lexicon is loaded once, on first use, and kept on the device.

### Private by design

There is no server. The extension, the desktop app and the command line make no network requests while checking, which is tested on every build. There is no account, no telemetry and no sync: your personal dictionary and settings stay on your device, and you can export or delete them at any time.

## The zimanyar command

<img src="assets/screenshots/cli-check.png" alt="zimanyar check reporting three Kurmanji findings with fixes and lessons">

```sh
zimanyar check notes.ku.md                    # findings, with explanations
zimanyar check --lang kmr --format json -     # read stdin, write JSON
zimanyar check --fix --rules kmr.orth *.md    # apply the safe spelling fixes
zimanyar explain ckb.morph.definite-allomorph # the rule, with examples and lessons
zimanyar conjugate xwendin                    # a full verb paradigm
zimanyar ipa "بە متمانەوە بە کوردی بنووسە"
zimanyar translit "Bi bawerî kurdî binivîse."
```

`zimanyar check` exits with 0 when the text is clean, 1 when there are findings at or above `--fail-on`, and 2 on a usage error, so it fits into CI.

## Learn Kurdish

The lessons Zimanyar links to come from zimankit's two complete courses, each with 23 lessons from beginner to advanced:

- [Central Kurdish (Sorani) course](https://github.com/0xdolan/zimankit/tree/main/docs/tutorials/ckb)
- [Northern Kurdish (Kurmanji) course](https://github.com/0xdolan/zimankit/tree/main/docs/tutorials/kmr)

## Development

You need Node 22 or newer with pnpm 10, [uv](https://docs.astral.sh/uv/), git and make.

```sh
make setup           # dependencies, git hooks and the UI skills
make lint            # Biome, TypeScript, dashes, Kurdish spelling, shellcheck, actionlint, ruff, knip
make test            # unit tests
make data            # fetch and verify the zimankit lexicon, export fixtures, compile the lexicons
make logo            # the logo SVG variants, from scripts/brand/make-logo.mjs
make icons           # every icon size for the extension, the web and Linux (Inkscape, ImageMagick)
make screenshots     # screenshots of the built apps with Playwright, into assets/screenshots/
make marketing       # banner, store tiles, store screenshots and ads (headless Chrome)
make check-dashes    # fail on em dashes, en dashes and look-alikes
```

| Path | What it holds |
| --- | --- |
| `assets/brand/` | The logo masters, wordmarks, [brand guide](assets/brand/README.md) and [design decisions](assets/brand/design.md) |
| `assets/icons/` | Rendered icons: PNG sizes, extension, web and PWA, the Linux hicolor tree |
| `assets/marketing/` | Banner, social preview, store tiles and screenshots, ads in English, Sorani and Kurmanji |
| `scripts/brand/` | The logo geometry and the icon renderer |
| `scripts/marketing/` | HTML templates and the content of every marketing image |
| `packages/rules/`, `packages/checker/` | The rules with their explanations, and the runner with its incremental cache and worker |
| `packages/i18n/`, `packages/ui/` | Interface strings in three languages, and the components |
| `apps/desktop/` | The Linux desktop app, with `packaging/` for its packages |
| `packages/app/` | The complete app the extension and desktop share |
| `apps/cli/`, `debian/` | The command line, and the Debian package of it |
| `apps/extension/` | The browser extension for Chrome and Firefox |
| `packages/settings/` | One validated settings schema for every surface |
| `apps/web/` | The website: the checker, the courses, the rules and the docs |
| `packages/content/` | The lessons, with tables rendered from the engine |
| `packages/editor/` | Underlines, the finding card and autocomplete on any text field |
| `packages/practice/` | Drills from the paradigms and rules, spaced repetition and the mistake history |
| `assets/screenshots/` | Screenshots from a real browser, regenerated by `make screenshots` |
| `corpus/` | The [gold error corpus](corpus/README.md) |
| `packages/core/` | The linguistic engine, a TypeScript port of zimankit |
| `packages/data/` | The compiled lexicon format and loaders, parity fixtures, and tables from zimankit |
| `packages/config/` | Shared TypeScript and Vitest configuration, design tokens |
| `scripts/checks/`, `scripts/release/` | Repository guards: dashes, Kurdish spelling, licences, attribution |
| `docs/` | [The name and the logo](docs/STORY.md), [developer documentation](docs/dev/) |

Contributors, human or tooling, follow the rules in [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md): no AI or bot attribution, no em or en dashes, and every interface string translated into English, Sorani and Kurmanji. Security reports go through [SECURITY.md](SECURITY.md).

## Branches and releases

Zimanyar follows git flow. Work happens on `feature/NAME` branches from `develop`, merged by pull request into `develop`. A release goes from `develop` to `main` on a `release/X.Y.Z` branch, also by pull request; `main` is what is released. Versions follow [Semantic Versioning](https://semver.org/), and every release has a tag and a changelog entry.

## Credits

- Linguistic engine and lessons: [zimankit](https://github.com/0xdolan/zimankit).
- Sibling project: [Roj](https://github.com/0xdolan/roj), the Kurdish solar calendar.
- Roj emblem: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Roj_emblem.svg), public domain. Story sources: [docs/STORY.md](docs/STORY.md).
- Fonts under the SIL Open Font License 1.1: [IBM Plex Sans](https://github.com/IBM/plex), [Vazirmatn](https://github.com/rastikerdar/vazirmatn).

## License

Code: [GPL-3.0-or-later](LICENSE) © 0xdolan. Bundled lexical data: CC BY-SA 4.0, see [NOTICE](NOTICE).

<p align="center"><img src="assets/icons/png/wordmark-light.png" width="360" alt="Zimanyar"></p>
