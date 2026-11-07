# Changelog

All notable changes to Zimanyar are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-07

### Added

- **brand:** Add logo, icons, marketing templates and the story
- **brand:** Add design tokens, contrast checks and render checks
- **data:** Compile the zimankit lexicon and export parity fixtures
- **core:** Port zimankit's shared text, language and phonology modules
- **core:** Port Sorani orthography, phonology, verbs and morphology
- **core:** Port Kurmanji orthography, phonology, verbs, morphology and ergativity
- **core:** Add spelling suggestions, completion and the compiled lexicon adapter
- **checker:** Add the document model, rule runner, incremental cache and worker
- **rules:** Add the Sorani rules and a draft gold corpus
- **rules:** Add the Kurmanji rules, including split ergativity
- **ui:** Add interface strings, the finding card and browser tests
- **checker:** Fetch spelling suggestions on demand, and add a worker client
- **editor:** Add underlines, the finding card and autocomplete on any text field
- **editor:** Let a findings panel reveal and ignore a finding
- **content:** Import the courses, with tables rendered from the engine
- **web:** Add the website, with the checker, courses, rules and docs
- **settings:** Add one settings schema, and share the checker panel
- **core:** Follow zimankit 0.3.1, with Sorani corrected against the written standard
- **extension:** Add the browser extension for Chrome and Firefox
- **desktop:** Add the Linux desktop app, with packages
- **cli:** Add the zimanyar command line
- **cli:** Add the zimanyar-lsp language server
- **practice:** Add drills, spaced repetition and the mistake history
- **editor:** Tell the caller about findings fixed and dismissed
- **app:** Add the Practice tab with reviews and lessons for frequent mistakes
- **brand:** Frame real app screenshots in the store screenshots
- **release:** Add the version bump, release notes, cut and sign scripts

### Fixed

- **brand:** Tighten the render tolerance to what CI measures
- **core:** Make the normalisers idempotent, as the plan requires
- **editor:** Tighten the stylesheet pattern and give the repository scan more time
- **rules:** Check Kurmanji typed on a Turkish keyboard, and accept glides without a lexicon
- **web:** Answer the security checks, and leave the API reference for now
- **extension:** Prepare before testing on a clean checkout, and drop eslint from wxt
- **desktop:** Record advisories with no fix, and find React by what a file holds
- **practice:** Strip final punctuation in linear time

### Changed

- **app:** Share the full app between the extension and the desktop

### Documentation

- Add assistant rules and repository hygiene
- Add contributing and security policies, developer docs and templates
- **desktop:** Record the distributions the packages ran on
- Show real screenshots, the current status and a working CLI example in the README

