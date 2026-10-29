---
name: zimanyar-release
description: Cut a Zimanyar release with git flow (release/X.Y.Z from develop into main), version bump across every manifest, changelog with git-cliff, screenshots, tag and artefact checklist, with the attribution check. Use when preparing, tagging or verifying a release or hotfix.
---

# Releasing Zimanyar

## Preconditions

- On `develop`, clean tree, `make lint` and `make test` green, CI green on `develop`.
- `make attribution` passes; no AI or bot attribution anywhere in the release range.

## Procedure

1. `git switch -c release/X.Y.Z develop`.
2. Bump the shared version everywhere: every `package.json`, the WXT manifest, `tauri.conf.json`,
   `debian/changelog`, `pyproject.toml`, the AppStream release list
   (`scripts/release/bump-version.ts` once it exists). The data version is separate.
3. `uv run git-cliff --tag vX.Y.Z -o CHANGELOG.md`; read it and fix wording by hand if needed.
4. `make screenshots marketing`; look at every changed image.
5. Full test suite; commit `chore(release): X.Y.Z` with the maintainer's identity only.
6. Push the branch, open a pull request into `main`, merge only when every check is green.
7. Tag `vX.Y.Z` on `main` (annotated, signed by the maintainer), push the tag. The release
   workflow builds and attaches the artefacts.
8. Merge `main` back into `develop`.

## Artefact checklist

- Extensions: Chrome zip, Firefox xpi and source zip, Safari Xcode zip.
- Desktop: `.deb`, `.rpm`, AppImage.
- CLI: `.deb`, linux-x64 tarball, npm tarball.
- Data tarball, `sbom.cdx.json`, `SHA256SUMS`, `SHA256SUMS.sig`, provenance attestations.
- Release notes are the version's CHANGELOG section.

## Never

- Never commit to `main` directly, force-push `main` or `develop`, or merge on a red check.
- Never add `Co-Authored-By:` trailers or "Generated with" lines.
- Never document store accounts, signing keys or secrets in the repository; they live in `private/`.
