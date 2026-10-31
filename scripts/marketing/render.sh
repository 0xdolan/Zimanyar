#!/usr/bin/env bash
# Render the marketing images into assets/marketing/ with headless Chrome.
# Uses a throwaway browser profile, so the user's own Chrome profile is never touched.
# Needs the icons first (make icons).
#
#   scripts/marketing/render.sh            all images
#   scripts/marketing/render.sh banner     only names containing "banner"
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/scripts/marketing"
OUT="$ROOT/assets/marketing"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
[ -n "$CHROME" ] || { echo "Chrome or Chromium is required (set CHROME=...)" >&2; exit 1; }
[ -f "$ROOT/assets/icons/png/logo-512.png" ] || "$ROOT/scripts/brand/render-icons.sh"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
FILTER="${1:-}"

# output path | page | width | height
JOBS=(
  "banner.png|banner.html|1280|640"
  "social-preview.png|banner.html|1280|640"
  "store/chrome-small-tile.png|store-small.html|440|280"
  "store/chrome-marquee.png|store-marquee.html|1400|560"
  "store/screenshot-1-check-sorani.png|screenshot.html?view=check|1280|800"
  "store/screenshot-2-explain-kurmanji.png|screenshot.html?view=explain|1280|800"
  "store/screenshot-3-learn.png|screenshot.html?view=learn|1280|800"
  "store/screenshot-4-everywhere.png|screenshot.html?view=everywhere|1280|800"
  "ads/ad-square-en.png|ad.html?lang=en&format=square|1080|1080"
  "ads/ad-square-ckb.png|ad.html?lang=ckb&format=square|1080|1080"
  "ads/ad-square-kmr.png|ad.html?lang=kmr&format=square|1080|1080"
  "ads/ad-landscape-en.png|ad.html?lang=en&format=landscape|1200|675"
  "ads/ad-story-en.png|ad.html?lang=en&format=story|1080|1920"
  "ads/ad-story-ckb.png|ad.html?lang=ckb&format=story|1080|1920"
  "ads/ad-story-kmr.png|ad.html?lang=kmr&format=story|1080|1920"
)

count=0
for job in "${JOBS[@]}"; do
  IFS='|' read -r out page w h <<<"$job"
  [[ -z "$FILTER" || "$out" == *"$FILTER"* ]] || continue
  mkdir -p "$OUT/$(dirname "$out")"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --user-data-dir="$PROFILE" --force-device-scale-factor=1 --allow-file-access-from-files \
    --virtual-time-budget=3000 --window-size="$w,$h" --screenshot="$OUT/$out" \
    "file://$HERE/$page" >/dev/null 2>&1
  count=$((count + 1))
done
echo "rendered $count marketing images into assets/marketing/"
