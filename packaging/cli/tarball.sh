#!/usr/bin/env bash
# Pack the single executable (make cli-sea) with its man page and licences as
# zimanyar-cli-VERSION-linux-ARCH.tar.gz, for systems without a .deb.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(node -p 'require(process.argv[1]).version' "$root/apps/cli/package.json")"
arch="$(node -p 'process.arch')"
name="zimanyar-cli-$version-linux-$arch"
out="$root/apps/cli/.output"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/$name" "$out"
cp "$root/apps/cli/dist/zimanyar" "$root/apps/cli/dist/THIRD-PARTY-NOTICES.txt" "$root/apps/cli/man/zimanyar.1" "$root/LICENSE" "$work/$name/"
cp "$(dirname "$(readlink -f "$(command -v node)")")/../LICENSE" "$work/$name/NODE-LICENSE.txt"
tar -C "$work" --owner=0 --group=0 --numeric-owner -czf "$out/$name.tar.gz" "$name"
echo "$out/$name.tar.gz"
