# The website

`apps/web` is an Astro and Starlight site, published to GitHub Pages from `main` by `pages.yml`. A pull request gets the same build as the `website-preview` artefact of the Browser tests job.

```sh
make data                             # the lexicons, for a checker with spelling
pnpm --filter @zimanyar/web dev       # with live reload
make e2e                              # build it and test it in a browser
```

## Pages

| where | what |
| --- | --- |
| `src/pages/[...locale]/` | landing, checker, learn, rules, download, desktop, privacy, about, changelog, licences, once per interface language, with every string from `t()` |
| `src/content/docs/docs/` | the guides, in English |
| `packages/content/lessons/` | the courses, read through the `glob` loader in `src/content.config.ts` |

English is at the root, and Sorani and Kurmanji under `/ckb/` and `/kmr/`. A page that exists only in English is shown in those with a note saying so, in Starlight's way.

Courses live at `/learn/sorani/` and `/learn/kurmanji/`, not under their language codes: Astro takes a locale code anywhere in a path for the interface language, which gave English lesson pages Sorani menus.

## Lessons

`scripts/content/import-zimankit-tutorials.ts` imports zimankit's tutorials from a checkout (`ZIMANKIT_DIR`, by default `../ku/zimankit`). It removes navigation and forbidden dashes, rewrites links, and replaces each generated block with a component from `packages/content/src/components.tsx`.

The components render when the site is built, so a lesson page has tables from the engine and no script for them. The output zimankit wrote for each block goes to `packages/content/fixtures/blocks.json`, and `packages/content/test/tables.test.ts` holds our tables to it.

`rehypeKurdish` wraps runs of Arabic script in prose with their language and direction.

## The checker

`src/islands/CheckerApp.tsx` is the page at `/check/`, and with `compact` the field on the landing page. It starts one worker when first needed, and fetches a lexicon of about 2 MB the first time it sees that variety. Checks do not wait for a lexicon: the answer without spelling comes first, and another follows when it has loaded.

A shared link holds the text after the `#`, which browsers do not send to servers.

## Offline

`public/sw.js` keeps pages from the network when there is one, and falls back to its copy otherwise. Files with a version or hash in their address come from the cache first. Raise `CACHE` in it when its own behaviour changes.

## Speed

Lighthouse is not a dependency, because it pulls in packages with known advisories and `pnpm`'s trust policy rejects its current version. To measure, run an isolated copy against `pnpm --filter @zimanyar/web preview`:

```sh
pnpm dlx lighthouse@12.8.2 http://localhost:4175/Zimanyar/check/ --view
```

In CI the `speed` tests in `scripts/screenshots/web.spec.ts` hold largest contentful paint under 2.5 s and layout shift under 0.1, and check that lessons run no island and that every page has a description.
