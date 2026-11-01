# Security model

Zimanyar's promise is that text never leaves the device. Each threat below has a check that fails if the mitigation goes.

| threat | mitigation | checked by |
| --- | --- | --- |
| a page reads or changes the overlay | closed shadow root per field, no scripts in the page's world | `session.test.tsx`, `extension.spec.ts` |
| a page sends messages to the extension | no `externally_connectable`; the background answers only its own extension's pages and content scripts, and validates every message with zod | `apps/extension/test/lib.test.ts`, `packages/checker/test` |
| a content script asks to load a lexicon | only the background loads lexicons; requests allow check, fix, suggest and complete | `apps/extension/test/lib.test.ts` |
| a password or card number is read | `isCheckable` refuses them by type and `autocomplete`, before any listener is added | `field.test.ts`, `extension.spec.ts` |
| text leaks | no network code but the fetch of the extension's own lexicons, and CSP `connect-src 'self'` | `extension.spec.ts` |
| over-broad permissions | host access is optional and per site; no `content_scripts` in the manifest | `extension.spec.ts` |
| XSS through suggestions or lessons | text nodes only, and lessons compiled at build time | Biome, review |
| a damaged settings file | `parseSettings` answers with usable settings whatever it is given | `packages/settings/test` |
| a shared link carries something hostile | its text is length-limited and only ever put in a text field | `web.spec.ts` |
| a malicious data bundle | SHA-256 pinned in `packages/data/VERSION`, verified before use | `make data` |
| supply chain | frozen lockfile, a seven-day release cooldown, a trust policy, actions pinned by hash, tools with open advisories kept out of the lockfile | CI |
