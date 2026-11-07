#!/usr/bin/env bash
# Build zimanyar-cli_VERSION_ARCH.deb from debian/ and the single executable (make cli-sea), then run
# lintian on it. Needs dpkg-buildpackage, debhelper and lintian: the build image (make cli-deb) or CI.
#
# dpkg-buildpackage writes next to the source tree, so the package is built in a temporary copy of
# what it holds, and nothing is written outside the repository.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/apps/cli/.output"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/src/apps/cli/dist" "$work/src/apps/cli/man" "$out"
cp -r "$root/debian" "$work/src/"
cp "$root/apps/cli/dist/zimanyar" "$root/apps/cli/dist/THIRD-PARTY-NOTICES.txt" "$work/src/apps/cli/dist/"
cp "$root/apps/cli/man/zimanyar.1" "$work/src/apps/cli/man/"
(cd "$work/src" && dpkg-buildpackage --build=binary --unsigned-source --unsigned-changes)
cp -f "$work"/zimanyar-cli_*.deb "$out/"
lintian --fail-on warning,error --info "$out"/zimanyar-cli_*.deb
echo "lintian: clean"
