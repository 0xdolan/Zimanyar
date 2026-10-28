# Notes for AI assistants working on Zimanyar

Read `PRD.md` first. It is the specification; implement it phase by phase (section 20).

## Attribution (absolute rule)

- Never add a `Co-Authored-By:` trailer for Claude, Anthropic or any bot, and never add "Generated with Claude Code" or similar lines to commits, pull requests, issues, release notes, code or docs.
- Commits are made with the repository owner's git identity only. Do not change `user.name` or `user.email`.
- Never create `.github/dependabot.yml`, Renovate configuration or any workflow that commits, pushes or opens pull requests. Workflows only read, build, test, report and publish artefacts.

## Writing

- Never write an em dash (U+2014), en dash (U+2013) or any look-alike (figure dash, horizontal bar, minus sign U+2212, box-drawing lines) anywhere: code, comments, docs, UI strings, translations, commit messages. Use a comma, colon, "·", "to", or a plain hyphen-minus.
- Kurdish is an Indo-European language in its own right, a macrolanguage. Never describe it as "Iranian" or "West Iranian". Name regions Başûr, Rojhilat, Bakur, Rojava; a state name goes in brackets only when needed for orientation.
- In Arabic-script text write "Kurdish" as کوردی (never کردی) and کوردستان.
- Every interface string goes through `t()` and needs entries in the English, Sorani and Kurmanji catalogues.

## Engineering

- TypeScript everywhere (strict). Python only for data export, always through `uv` (`uv run`, `uv add`); never pip or a system Python.
- The linguistic engine (`packages/core`) must stay free of DOM, browser and Node-only APIs so it runs in workers, Node and Tauri alike.
- Behaviour of the engine must match zimankit (`github.com/0xdolan/zimankit`); parity fixtures decide. Record intentional differences in `docs/dev/parity-exceptions.md`.
- No network requests from the checker, extension or desktop app.
- Install and use the shadcn skill (`pnpm dlx skills add shadcn/ui`) and the ui-ux-pro-max skill before UI work (PRD section 12.1).
- Verify UI changes with Playwright screenshots (`make screenshots`), never in the user's own browser profile. When a change alters anything a screenshot shows, regenerate, look at every changed image and commit them with the change.
- Account and deployment setup (store accounts, signing keys, repository secrets) is never documented in the repository; local notes live in `private/`, which git ignores.

## Git flow

- `main` is the default and release branch; `develop` is the integration branch. Work on `feature/NAME` from `develop`, open a pull request into `develop`.
- Never commit directly to `main`. Releases go through `release/X.Y.Z` (see `RELEASING.md` once it exists, and PRD section 17.3).
- Conventional Commits. When `make test` and `make lint` pass, push the feature branch and open the pull request; never merge on a red check.
