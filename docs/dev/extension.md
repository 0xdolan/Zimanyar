# The extension

`apps/extension` is built with [WXT](https://wxt.dev/) for Chrome and Firefox, on Manifest V3. It runs only on sites you turn on.

```sh
make data                                 # the lexicons
pnpm --filter @zimanyar/extension build   # .output/chrome-mv3 and .output/firefox-mv3
make extension-lint                       # Mozilla's linter on the Firefox build
make e2e                                  # browser tests, with the unpacked extension
```

## How it fits together

| entry point | does |
| --- | --- |
| `background` | runs the checker and loads lexicons when first needed, registers the content script for enabled sites, handles the context menu and shortcuts |
| `content` | attaches the editor to a text field when it takes focus, on enabled sites |
| `popup` | turns the current site on or off, checks a page once, and has a small text field |
| `options` | every setting, saved as it changes |
| `app`, `sidepanel` | the full app: checker, lesson reader, verb and noun forms, tools |

The checker runs in the background context, not a worker, because a page's content security policy can block a worker from a content script. A service worker can stop at any time and loads its lexicons again when next needed, which takes tens of milliseconds.

Lessons are compiled with the extension from `packages/content/lessons`, so a finding's lesson opens with no network. The verb pages are left out, as the forms tab computes the same tables.

Settings come from `@zimanyar/settings`, and everything that shows or checks text follows them through `storage.onChanged`.

## Permissions

`storage`, `activeTab`, `scripting`, `contextMenus` and, on Chrome, `sidePanel`. Host access is optional: Zimanyar asks for one site at a time when it is turned on there, or for all sites only from the settings page. No `content_scripts` entry exists in the manifest. Each permission is explained in `packages/content/marketing/store-listing.json`, and a test checks both.

## Build choices

- **`connect-src 'self'`, not `'none'`.** `'none'` would also block the lexicons, which are the extension's own files. `'self'` reaches nothing outside it. A browser test checks that no request leaves, and a scan of the build finds one `fetch` in all of it.
- **`web-ext` is left out** through a pnpm override, as `wxt` needs it only to launch a browser in dev mode, and it brings `node-forge`, with advisories that have no fix. `wxt dev` will not launch a browser by itself.
- **`addons-linter` runs in isolation** through `pnpm dlx`, as it brings packages with open advisories. It is what `web-ext lint` runs. `scripts/checks/check-extension-lint.ts` allows only react-dom's own `innerHTML` assignments.
- **zod's `eval` probe is removed at build time.** Under our policy it could only fail, and each failure logs a security violation.
- **A test build differs in two ways**, both behind `ZIMANYAR_E2E`: the overlay's shadow root is open so that tests can read it, and localhost needs no permission, as a test cannot press Allow.

## Fonts on web pages

The overlay's stylesheet carries the two Vazirmatn weights inside it, about 60 KB, as a page's policy may refuse a font file from an extension. A page's policy can also refuse those, and Latin text uses the system font. Both fall back cleanly.

## Not yet

- Safari: `wxt build -b safari` comes with the release work, and needs Xcode on macOS.
- Settings for a Sorani mark helper (`ر` to `ڕ` on demand), practice reminders and IPA on hover.
