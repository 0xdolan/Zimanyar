---
name: zimanyar-security-review
description: Threat-model checklist for any Zimanyar change that touches content scripts, extension messaging, permissions, Tauri IPC, data loading, rendering of suggestions or lessons, dependencies or GitHub workflows. Use before opening a pull request with such changes.
---

# Security review

Zimanyar's promise is that text never leaves the device. Review every change in these areas
against the matching checklist and fix findings before opening the pull request.

## Content scripts and extension pages

- [ ] UI injected into pages lives in a closed Shadow DOM; no scripts in the page world.
- [ ] Page data is never trusted: no reading page globals, no `postMessage` without origin checks.
- [ ] Every message across content script, background and worker is validated with zod.
- [ ] Extension pages keep CSP `connect-src 'none'`; no remote code, no `unsafe-eval`.
- [ ] Permissions: host access stays optional and per site; any new permission is justified in
      the store listing texts.

## Rendering

- [ ] No `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `dangerouslySetInnerHTML`.
- [ ] Suggestions, messages and lesson content are rendered as text nodes; MDX is compiled at
      build time.

## Network

- [ ] No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` in the checker,
      the extension or the desktop app. The privacy test must still show zero requests.

## Desktop (Tauri)

- [ ] Capabilities are minimal (clipboard, dialog, fs scoped to user-chosen files); no remote URLs.
- [ ] Commands validate their arguments; the Rust side has no business logic.

## Data

- [ ] Downloaded bundles are verified against the SHA-256 in `packages/data/VERSION` before use.
- [ ] Lexicon parsing is bounded (sizes, offsets) and never evaluates content.

## Dependencies and workflows

- [ ] New dependencies are needed, maintained, and pass `make licenses`; install scripts stay
      disabled unless allow-listed in `pnpm-workspace.yaml`.
- [ ] Actions are pinned by full commit SHA with a version comment; `permissions` are minimal
      per job; no `pull_request_target` with checkout of untrusted code; no untrusted
      `${{ }}` expressions inside `run:` (pass them through `env:`).
- [ ] Workflows never push commits or open pull requests.
