#!/usr/bin/env bash
# Compare rendered images in the working tree with the committed ones. Identical renders are
# expected on one machine; across machines, renderer versions move pixels slightly, so each
# changed PNG is allowed a small root mean square error (normalised 0 to 1).
#
#   scripts/brand/compare-renders.sh                 after make icons marketing
#   BRAND_TOLERANCE=0.01 scripts/brand/compare-renders.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOLERANCE="${BRAND_TOLERANCE:-0.01}"
cd "$ROOT"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

# SVGs are generated from one geometry definition and must match exactly. The wordmarks are
# excluded: Inkscape writes their outlines differently from version to version.
if ! git diff --quiet -- 'assets/brand/logo*.svg' assets/brand/src 'assets/icons/**/*.svg'; then
  git diff --stat -- 'assets/brand/logo*.svg' assets/brand/src 'assets/icons/**/*.svg' >&2
  echo "generated SVGs differ from the committed ones; run make icons and commit" >&2
  failures=$((failures + 1))
fi

# Everything committed must still be there, nothing new may appear.
missing="$(git ls-files --deleted -- assets/icons assets/marketing; git ls-files --others --exclude-standard -- assets/icons assets/marketing)"
if [[ -n "$missing" ]]; then
  echo "render output and committed files disagree:" >&2
  echo "$missing" >&2
  failures=$((failures + 1))
fi

checked=0 worst=0
while IFS= read -r path; do
  [[ -f "$path" ]] || continue
  git show "HEAD:$path" >"$work/old.png"
  metric="$(compare -metric RMSE "$path" "$work/old.png" null: 2>&1 || true)"
  # ImageMagick prints: absolute (normalised)
  score="$(sed -n 's/.*(\([0-9.e+-]*\)).*/\1/p' <<<"$metric")"
  if [[ -z "$score" ]]; then
    echo "$path: cannot compare ($metric)" >&2
    failures=$((failures + 1))
    continue
  fi
  checked=$((checked + 1))
  awk -v a="$score" -v b="$worst" 'BEGIN { exit !(a > b) }' && worst="$score"
  if awk -v a="$score" -v b="$TOLERANCE" 'BEGIN { exit !(a > b) }'; then
    echo "$path: differs by $score (tolerance $TOLERANCE)" >&2
    failures=$((failures + 1))
  fi
done < <(git diff --name-only -- 'assets/**/*.png')

echo "compared $checked changed images, worst difference $worst"
((failures == 0)) || { echo "$failures render check(s) failed" >&2; exit 1; }
