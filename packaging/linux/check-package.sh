#!/usr/bin/env bash
# Everything a package is held to: lintian, AppStream and desktop entry validation.
set -euo pipefail
deb="$1"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dpkg-deb -x "$deb" "$work"
desktop-file-validate "$work"/usr/share/applications/*.desktop
appstreamcli validate --no-net --pedantic "$work"/usr/share/metainfo/*.metainfo.xml
lintian --fail-on warning,error --suppress-tags-from-file packaging/linux/lintian-suppressed "$deb"
