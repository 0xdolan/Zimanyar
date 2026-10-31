# Contributing to Zimanyar

Thank you for helping Kurdish writers. These rules keep the project consistent; the hooks and CI enforce most of them.

## Getting started

You need Node 22 or newer with pnpm 10 (`corepack enable`), [uv](https://docs.astral.sh/uv/), git and make.

```sh
make setup    # pnpm install, uv sync, git hooks
make lint     # every static check
make test     # unit tests
```

Shellcheck, actionlint, ruff and git-cliff come from the uv dev group, so you do not need to install them yourself. Developer documentation is in [docs/dev/](docs/dev/).

## Rules

1. **Git flow.** `main` is the release branch and `develop` the integration branch. Branch `feature/NAME` from `develop` and open a pull request into `develop`. Nothing reaches `main` except through `release/X.Y.Z` or `hotfix/X.Y.Z`.
2. **Conventional Commits.** `feat(core): port the tokenizer`, `fix(rules): ...`, `docs: ...`. The changelog is generated from them.
3. **No AI or bot attribution.** No `Co-Authored-By:` trailers for AI assistants or bots, no "Generated with ..." lines, in commits, pull requests, issues, release notes, code or docs. There is no Dependabot or Renovate configuration; dependencies are updated by the maintainer. The commit-msg hook and the contributors-guard workflow reject violations.
4. **No dashes.** Never write an em dash, en dash or a look-alike (figure dash, horizontal bar, minus sign U+2212, box-drawing lines) anywhere. Use a comma, a colon, "·", "to" or a plain hyphen-minus. `make check-dashes` enforces it.
5. **Kurdish terms.** Kurdish is an Indo-European language in its own right, a macrolanguage: never describe it as "Iranian" or "West Iranian". Name the regions Başûr, Rojhilat, Bakur and Rojava, with a state name in brackets only when needed for orientation. In Arabic script write "Kurdish" as کوردی (never کردی) and Kurdistan as کوردستان. `make check-spelling` enforces the spellings.
6. **Three languages.** Every interface string goes through `t()` and has entries in the English, Sorani and Kurmanji catalogues.
7. **TypeScript, strict.** Python is used only to export data from zimankit, always through `uv run` and `uv add`, never pip.
8. **The engine stays portable.** `packages/core` uses no DOM, browser or Node-only APIs, so it runs in workers, Node and Tauri.
9. **Parity with zimankit.** The engine must behave like [zimankit](https://github.com/0xdolan/zimankit); parity fixtures decide. Intentional differences go in [docs/dev/parity-exceptions.md](docs/dev/parity-exceptions.md).
10. **Private by design.** No network requests from the checker, the extension or the desktop app.
11. **Screenshots.** When a change alters anything a screenshot shows, run `make screenshots`, look at every changed image and commit them with the change. Never use your own browser profile for this.
12. **Rules need evidence.** A new checking rule needs metadata in three languages, at least 20 tests, two wrong and right examples, a lesson link and gold corpus entries.

## Pull requests

Fill in the template, keep pull requests focused, and wait for green checks. A red check is never merged.

## Reporting problems

Use the issue forms: bug, wrong suggestion or missed error, feature, lesson error. Security problems go to [private advisories](SECURITY.md), never to public issues.

## Licence

By contributing you agree that your code is licensed under GPL-3.0-or-later and lexical data under CC BY-SA 4.0.
