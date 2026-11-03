#!/usr/bin/env bash
# Run a command in the desktop build image, as yourself, with the repository mounted and Rust's caches kept in a
# Docker volume. Nothing is installed on your own system.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
docker build -q -t zimanyar-desktop-build -f "$root/packaging/linux/build.Dockerfile" "$root/packaging/linux" > /dev/null
docker volume create zimanyar-desktop-cache > /dev/null
docker run --rm -v zimanyar-desktop-cache:/cache alpine:3 chown "$(id -u):$(id -g)" /cache
exec docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/cache/home -e CARGO_HOME=/cache/cargo -e CARGO_TARGET_DIR=/cache/target \
  -e ASTRO_TELEMETRY_DISABLED=1 \
  -v zimanyar-desktop-cache:/cache -v "$root:$root" -w "$root" \
  zimanyar-desktop-build "$@"
