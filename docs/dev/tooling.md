# Tooling

## Monorepo

pnpm workspaces with Turborepo. Node 22 or newer (`.nvmrc`), pnpm from the `packageManager` field.

| path | content |
| --- | --- |
| `packages/config` | shared `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest preset and design tokens |
| `packages/*` | libraries: `core`, `rules`, `checker`, `data`, `ui`, ... as they are built |
| `apps/*` | web, extension, desktop, cli, lsp |
| `scripts` | the `@zimanyar/scripts` workspace: repository checks, release and brand scripts, and their tests |

The repository root is also a [uv](https://docs.astral.sh/uv/) project (`pyproject.toml`, Python 3.13). It holds no Python package; it pins the Python used for data export and the dev tools that are easiest to get from PyPI: ruff, shellcheck, actionlint and git-cliff.

## Make targets

| target | does |
| --- | --- |
| `make setup` | `pnpm install --frozen-lockfile`, `uv sync --frozen`, installs the git hooks |
| `make lint` | Biome, TypeScript, dashes, Kurdish spelling, contrast, tokens in sync, shellcheck, actionlint, ruff, knip, imports |
| `make test` / `make coverage` | Vitest in every workspace, through Turborepo |
| `make build` | builds every package and app |
| `make tokens` | writes `packages/config/tokens.css` from the design tokens |
| `make check-brand` | renders icons and marketing and compares them with the committed images |
| `make data` | fetches and verifies the pinned lexicon, exports the fixtures and compiles the lexicons ([data.md](data.md)) |
| `make licenses` | production dependencies against the GPL-3.0 compatible allow list |
| `make attribution` | authors, committers and trailers of the commits on this branch |
| `make deps` | dependency report (outdated, audit, uv upgrades); never changes files |

## Git hooks (lefthook)

| hook | runs |
| --- | --- |
| pre-commit | Biome on staged code, dashes and Kurdish spelling on staged files, typecheck of affected workspaces |
| commit-msg | `scripts/release/verify-attribution.sh`, dashes, commitlint |
| pre-push | unit tests |

## Guards

| script | rejects |
| --- | --- |
| `scripts/checks/check-dashes.sh` | em and en dashes and their look-alikes |
| `scripts/checks/check-kurdish-spelling.ts` | Arabic-script misspellings of Kurdish and Kurdistan; calling Kurdish "Iranian" (a line with `kurdish-spelling: allow` is skipped) |
| `scripts/checks/check-contrast.ts` | design token colour pairs below WCAG 2.2 AA, in either theme |
| `scripts/brand/compare-renders.sh` | rendered images that differ from the committed ones beyond a small tolerance, generated SVGs that differ at all |
| `scripts/checks/check-imports.ts` | circular imports, and a package importing from a higher layer |
| `scripts/checks/check-licenses.ts` | production dependencies with licences that cannot be combined with GPL-3.0 |
| `scripts/release/verify-attribution.sh` | commit messages that credit an AI assistant or a bot |
| `scripts/release/verify-contributors.sh` | commits by anyone not in `.github/allowed-authors.txt`, and Dependabot or Renovate configuration |

## CI workflows

| workflow | trigger | jobs |
| --- | --- | --- |
| `ci.yml` | push to git flow branches, pull requests into `main` and `develop` | lint, test with coverage, build, data |
| `contributors-guard.yml` | push, pull request | `verify-contributors.sh` on the new commits |
| `security.yml` | pull request, push to `main` and `develop`, nightly | gitleaks, Semgrep, `pnpm audit` and licences, OSV-Scanner |
| `brand.yml` | changes to `assets/`, `scripts/brand/` or `scripts/marketing/` | `make check-brand` with Inkscape, ImageMagick, Chrome and the fonts |
| `codeql.yml` | push and pull requests on `main` and `develop`, weekly | CodeQL for TypeScript, Python and workflows |

Every third-party action is pinned by full commit SHA with the version in a comment. Workflows default to `contents: read` and never push commits or open pull requests. Shared setup lives in `.github/actions/setup`.

Updating a pinned action: look up the release's commit with `gh api repos/OWNER/REPO/commits/TAG --jq .sha`, replace the SHA and the comment, and run `make actionlint`.
