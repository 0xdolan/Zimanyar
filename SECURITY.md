# Security policy

Zimanyar checks text on your device. The extension, the desktop app and the command line make no network requests while checking, so a vulnerability that leaks text, runs code from a web page or abuses extension or desktop permissions is the most serious kind of bug here.

## Reporting a vulnerability

Report it privately through [GitHub Security Advisories](https://github.com/0xdolan/Zimanyar/security/advisories/new). Do not open a public issue.

Please include the affected surface (website, extension and browser, desktop app, CLI, language server), the version, and steps or a proof of concept.

| step | time |
| --- | --- |
| acknowledgement | within 3 days |
| first assessment | within 7 days |
| fix for a confirmed high or critical issue | within 30 days, released as a patch version |

You will be credited in the release notes unless you ask not to be.

## Supported versions

Zimanyar has no release yet. Once 1.0.0 is out, the latest minor version receives security fixes.

## What is checked on every change

- CodeQL, Semgrep and gitleaks on every pull request.
- OSV-Scanner and `pnpm audit` on every pull request and every night.
- Licences of production dependencies against a GPL-3.0 compatible allow list.
- All third-party GitHub Actions are pinned by full commit SHA; workflows default to read-only permissions and never push commits.
- Dependency install scripts are disabled unless allow-listed in `pnpm-workspace.yaml`.
