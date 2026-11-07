#!/usr/bin/env bash
# Cut release/X.Y.Z from develop (RELEASING.md, steps 1 to 5): bump every version, write the
# changelog, regenerate screenshots and marketing images, run the tests and commit. Pushing,
# the pull request into main and the tag stay with the maintainer.
#
#   make release V=X.Y.Z [NOTE="One sentence for the Debian and AppStream changelogs."]
set -euo pipefail
version="${1:?usage: release.sh X.Y.Z [note]}"
note="${2:-Version $version.}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo "release: $version is not X.Y.Z" >&2; exit 2; }
[[ "$(git branch --show-current)" == develop ]] || { echo "release: start on develop" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "release: the working tree is not clean" >&2; exit 1; }
git fetch --quiet origin
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/develop)" ]] || { echo "release: develop is not at origin/develop" >&2; exit 1; }
! git rev-parse --quiet --verify "refs/tags/v$version" > /dev/null || { echo "release: v$version already exists" >&2; exit 1; }

make test
git switch -c "release/$version"
pnpm exec tsx scripts/release/bump-version.ts "$version" "$note"
uv run --frozen git-cliff --tag "v$version" -o CHANGELOG.md
scripts/release/release-notes.sh "$version" > /dev/null
make screenshots marketing
make lint test
git add -A
git commit -m "chore(release): $version"
echo "release/$version is ready: read CHANGELOG.md and every changed image, then push and open a pull request into main."
