# Releasing Zimanyar

Every product surface shares one [Semantic Versioning](https://semver.org/) version. The data
version in `packages/data/VERSION` is separate and changes only with the lexicon bundle.

## Releases

1. **Preconditions.** On `develop`, clean tree, at `origin/develop`, CI green on `develop`.
2. **Cut the branch.** `make release V=X.Y.Z NOTE="One sentence."` runs `make test`, creates
   `release/X.Y.Z`, sets the version everywhere with `scripts/release/bump-version.ts` (every
   `package.json`, the WXT manifest through it, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`,
   both Debian changelogs, the AppStream release list, `pyproject.toml`, `uv.lock`), writes
   `CHANGELOG.md` with git-cliff, runs `make screenshots marketing` and `make lint test`, and
   commits `chore(release): X.Y.Z`. `NOTE` goes into the Debian and AppStream entries.
3. **Review.** Read the new `CHANGELOG.md` section and fix its wording by hand where needed;
   look at every changed image. Amend the release commit with any fixes.
4. **Pull request into `main`.** Push `release/X.Y.Z` and open a pull request into `main`.
   Merge it with a merge commit only when every check is green.
5. **Tag.** On the updated `main`: `git tag -s vX.Y.Z -m "Zimanyar X.Y.Z"`, then
   `git push origin vX.Y.Z`.
6. **Release workflow.** The tag starts `.github/workflows/release.yml`, which checks that the
   tag matches `package.json`, builds every artefact below, writes `sbom.cdx.json` and
   `SHA256SUMS`, attests the provenance of every file and leaves a **draft** release whose notes
   are the version's changelog section (`scripts/release/release-notes.sh`).
7. **Sign and publish.** `make release-sign V=X.Y.Z` downloads the draft's assets, checks them
   against `SHA256SUMS` and their attestations, signs `SHA256SUMS` with the maintainer's key as
   `SHA256SUMS.sig`, uploads it and publishes the release.
8. **Back into `develop`.** `develop` is protected, so open a pull request from `main` into
   `develop` (`gh pr create --base develop --head main`) and merge it with a merge commit when
   the checks are green. The merge into `main` has already deployed the website (`pages.yml`).
9. **Stores.** Upload the Chrome zip and the Firefox xpi with its source zip to the stores by hand.
10. **Ubuntu PPA.** `make ppa V=X.Y.Z SERIES="noble ..." KEY=KEYID` builds signed source packages
    of `zimanyar` and `zimanyar-cli` for each Ubuntu release from the published release files,
    after checking them against `SHA256SUMS`, and prints the `dput` commands that upload them.
    Launchpad builds without a network, so the packages carry the released programs and install
    them; they need glibc 2.39, so `noble` (24.04) is the oldest release. The orig tarballs come
    out the same on every run, so a later run for a new Ubuntu release uploads cleanly; uploading
    the same version for the same release again needs `PPA_REVISION=2`.

A pull request that changes `release.yml`, `scripts/release/`, `packaging/` or `debian/` runs the
same builds as a rehearsal, publishes nothing and keeps the files as an artefact for three days.

## Artefacts

| file | what |
|---|---|
| `zimanyar-chrome-X.Y.Z.zip` | Chrome extension, for the Chrome Web Store |
| `zimanyar-firefox-X.Y.Z.xpi` | Firefox extension, unsigned, for AMO |
| `zimanyar-firefox-X.Y.Z-source.zip` | the tagged source tree, for AMO review (build: `make setup data`, then `pnpm --filter @zimanyar/extension build`) |
| `zimanyar-safari-X.Y.Z-xcode.zip` | Xcode project for Safari on macOS, built in CI and not tested |
| `zimanyar_X.Y.Z_{amd64,arm64}.deb`, `zimanyar-X.Y.Z-1.{x86_64,aarch64}.rpm`, `zimanyar_X.Y.Z_{amd64,arm64}.AppImage` | desktop app |
| `zimanyar-cli_X.Y.Z_{amd64,arm64}.deb`, `zimanyar-cli-X.Y.Z-linux-{x64,arm64}.tar.gz`, `zimanyar-X.Y.Z.tgz` | command line and language server; the last is the npm package |
| `zimanyar-data-X.Y.Z.tar.zst` | compiled lexicons and tables with their licence and lock file |
| `sbom.cdx.json` | CycloneDX software bill of materials |
| `SHA256SUMS`, `SHA256SUMS.sig` | checksums, and the maintainer's signature over them |

Check a download with `sha256sum --check --ignore-missing SHA256SUMS`,
`gpg --verify SHA256SUMS.sig SHA256SUMS` and `gh attestation verify FILE --repo 0xdolan/Zimanyar`.

## Hotfixes

Branch `hotfix/X.Y.Z` from `main`, fix, set the version with
`pnpm exec tsx scripts/release/bump-version.ts X.Y.Z "One sentence."`, write the changelog with
`uv run git-cliff --tag vX.Y.Z -o CHANGELOG.md`, open a pull request into `main` and continue at
step 5. Merge `main` into `develop` afterwards.

## Never

- Commit to `main` directly, force-push `main` or `develop`, or merge on a red check.
- Add `Co-Authored-By:` trailers for AI assistants or bots, or "Generated with" lines, anywhere
  in a release.
- Put store accounts, signing keys or secrets in the repository.
