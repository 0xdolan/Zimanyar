#!/usr/bin/env bash
# Render every icon size from the SVG masters in assets/brand/ into assets/icons/.
# Detail level is chosen per size: favicon art up to 24 px, the small logo up to 64 px,
# the full logo above. Needs inkscape and ImageMagick (magick).
#
#   scripts/brand/render-icons.sh        (or: make icons)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRAND="$ROOT/assets/brand"
OUT="$ROOT/assets/icons"

command -v inkscape >/dev/null || { echo "inkscape is required" >&2; exit 1; }
# ImageMagick 7 installs magick, ImageMagick 6 (Ubuntu's package) installs convert.
MAGICK="$(command -v magick || command -v convert || true)"
[[ -n "$MAGICK" ]] || { echo "ImageMagick is required" >&2; exit 1; }

node "$ROOT/scripts/brand/make-logo.mjs"

png() { # source size destination
  mkdir -p "$(dirname "$3")"
  inkscape "$1" -o "$3" -w "$2" -h "$2" >/dev/null 2>&1
}
source_for() { # size -> best master for that size
  if (( $1 <= 24 )); then echo "$BRAND/logo-favicon.svg"
  elif (( $1 <= 64 )); then echo "$BRAND/logo-small.svg"
  else echo "$BRAND/logo.svg"; fi
}

rm -rf "$OUT"
mkdir -p "$OUT"

# General sizes (README, website, stores, Tauri source image)
for s in 16 24 32 48 64 96 128 256 512 1024; do
  png "$(source_for "$s")" "$s" "$OUT/png/logo-$s.png"
done

# Browser extension (Chrome, Firefox, Safari via WXT: public/icon/<size>.png)
for s in 16 19 32 38 48 96 128; do
  png "$(source_for "$s")" "$s" "$OUT/extension/icon-$s.png"
done
png "$BRAND/logo-symbolic.svg" 32 "$OUT/extension/icon-symbolic-32.png"

# Website and PWA
cp "$BRAND/logo-favicon.svg" "$OUT/web/favicon.svg" 2>/dev/null || { mkdir -p "$OUT/web"; cp "$BRAND/logo-favicon.svg" "$OUT/web/favicon.svg"; }
png "$BRAND/logo-favicon.svg" 16 "$OUT/web/.f16.png"
png "$BRAND/logo-favicon.svg" 32 "$OUT/web/.f32.png"
png "$BRAND/logo-small.svg" 48 "$OUT/web/.f48.png"
"$MAGICK" "$OUT/web/.f16.png" "$OUT/web/.f32.png" "$OUT/web/.f48.png" "$OUT/web/favicon.ico"
rm -f "$OUT"/web/.f*.png
png "$BRAND/logo-maskable.svg" 180 "$OUT/web/apple-touch-icon.png"
png "$BRAND/logo.svg" 192 "$OUT/web/icon-192.png"
png "$BRAND/logo.svg" 512 "$OUT/web/icon-512.png"
png "$BRAND/logo-maskable.svg" 192 "$OUT/web/icon-maskable-192.png"
png "$BRAND/logo-maskable.svg" 512 "$OUT/web/icon-maskable-512.png"
cp "$BRAND/logo-symbolic.svg" "$OUT/web/safari-pinned-tab.svg"

# Linux (freedesktop hicolor theme), used by the desktop app and the .deb packages
for s in 16 22 24 32 48 64 128 256 512; do
  png "$(source_for "$s")" "$s" "$OUT/linux/hicolor/${s}x${s}/apps/zimanyar.png"
done
mkdir -p "$OUT/linux/hicolor/scalable/apps" "$OUT/linux/hicolor/symbolic/apps"
cp "$BRAND/logo.svg" "$OUT/linux/hicolor/scalable/apps/zimanyar.svg"
cp "$BRAND/logo-symbolic.svg" "$OUT/linux/hicolor/symbolic/apps/zimanyar-symbolic.svg"

# Wordmarks: text converted to paths so they render without the fonts installed
for theme in light dark; do
  inkscape "$BRAND/src/wordmark-$theme.svg" --export-text-to-path --export-plain-svg \
    -o "$BRAND/wordmark-$theme.svg" >/dev/null 2>&1
  inkscape "$BRAND/wordmark-$theme.svg" -o "$OUT/png/wordmark-$theme.png" -w 1640 -h 512 >/dev/null 2>&1
done

count=$(find "$OUT" -type f | wc -l)
echo "rendered $count icon files into assets/icons/"
