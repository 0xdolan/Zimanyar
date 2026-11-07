#!/usr/bin/env bash
# Print one version's section of CHANGELOG.md, without its heading: the release notes.
#
#   scripts/release/release-notes.sh 1.0.0 [CHANGELOG.md]
set -euo pipefail
version="${1:?usage: release-notes.sh X.Y.Z [CHANGELOG.md]}"
changelog="${2:-CHANGELOG.md}"
notes="$(awk -v heading="## [$version]" '
  /^## \[/ { inside = index($0, heading) == 1; next }
  inside
' "$changelog")"
if [[ -z "${notes//[[:space:]]/}" ]]; then
  echo "release-notes: no section for $version in $changelog" >&2
  exit 1
fi
printf '%s\n' "$notes"
