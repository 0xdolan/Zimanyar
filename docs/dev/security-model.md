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
| a compromised page in the desktop app reaches the system | no remote URLs, a strict CSP, minimal capabilities per window, and files only through a dialog | `desktop.spec.ts` |
| a damaged settings file | `parseSettings` answers with usable settings whatever it is given | `packages/settings/test` |
| a shared link carries something hostile | its text is length-limited and only ever put in a text field | `web.spec.ts` |
| a malicious data bundle | SHA-256 pinned in `packages/data/VERSION`, verified before use | `make data` |
| supply chain | frozen lockfile, a seven-day release cooldown, a trust policy, actions pinned by hash, tools with open advisories kept out of the lockfile | CI |
| a checked file drives the terminal | the text report writes control characters from files and their names as `\u` escapes | `apps/cli/test/check.test.ts` |
| text leaks from the command line | no network code; a test traps fetch, sockets, DNS and HTTP while every command runs | `apps/cli/test/privacy.test.ts` |
| text leaks from the language server | no network code; the same test runs a whole session with the traps in place | `apps/cli/test/privacy.test.ts` |
| an editor sends hostile settings | `settingsOf` keeps only values of the right shape and ignores the rest | `apps/cli/test/lsp.test.ts` |
| a document injects links or HTML into a hover | text from the document and from messages is escaped as Markdown; only the lesson and rule links are markup | `apps/cli/test/lsp.test.ts` |
| a fix changes Markdown markup | findings that touch code, links or HTML, blanked before checking, are dropped | `apps/cli/test/check.test.ts` |
| the single executable's tools | `postject` runs through `pnpm dlx` at an exact version only while packaging, outside the lockfile and the program | review |
