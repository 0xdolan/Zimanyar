#!/usr/bin/env bash
# Build the source packages for the Launchpad PPA, one per Ubuntu release, from the files of a GitHub
# release: zimanyar (the desktop app) and zimanyar-cli (the command line and language server).
#
#   packaging/ppa/build-source.sh VERSION SERIES...      e.g. 1.0.0 noble questing
#
# Launchpad builds without a network, and the Node and Tauri builds cannot run there, so the orig
# tarballs carry the released executables in prebuilt/ARCH and debian/rules installs them. The
# released programs need glibc 2.39, so the oldest release they run on is noble (24.04).
#
# KEY=<gpg key id> signs the packages for upload; without it they are unsigned, to test locally.
# PPA_REVISION=N (default 1) starts again for the same version, e.g. after a packaging fix.
# RELEASE_DIR=<dir> uses release files already downloaded instead of fetching them with gh.
# PPA=ppa:OWNER/NAME (default ppa:0xdolan/zimanyar) is the archive named in the upload commands.
# The packages land in packaging/ppa/.output/.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="${1:?usage: build-source.sh VERSION SERIES...}"
shift
[ $# -gt 0 ] || { echo "name at least one Ubuntu release, e.g. noble" >&2; exit 2; }
revision="${PPA_REVISION:-1}"
ppa="${PPA:-ppa:0xdolan/zimanyar}"
out="$root/packaging/ppa/.output"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out"

if [ -n "${KEY:-}" ]; then sign=(-k"$KEY"); else sign=(-us -uc); fi

assets="${RELEASE_DIR:-$work/assets}"
if [ -z "${RELEASE_DIR:-}" ]; then
  gh release download "v$version" -R 0xdolan/Zimanyar -D "$assets" -p SHA256SUMS \
    -p "zimanyar-cli-$version-linux-*.tar.gz" -p "zimanyar_${version}_*.deb"
fi
(cd "$assets" && sha256sum --ignore-missing --strict -c SHA256SUMS)

# The same version must always get the same orig tarball, or Launchpad refuses the next upload.
epoch="$(dpkg-parsechangelog -l "$root/debian/changelog" -S Timestamp)"
orig() {
  tar --sort=name --mtime="@$epoch" --owner=0 --group=0 --numeric-owner -C "$work" -cf - "$1" | xz -6 -T1 > "$out/$2"
}

cli="zimanyar-cli-$version"
for pair in amd64:x64 arm64:arm64; do
  arch="${pair%%:*}"
  tar -xzf "$assets/zimanyar-cli-$version-linux-${pair#*:}.tar.gz" -C "$work"
  install -D -t "$work/$cli/prebuilt/$arch" "$work/zimanyar-cli-$version-linux-${pair#*:}"/{zimanyar,NODE-LICENSE.txt,THIRD-PARTY-NOTICES.txt}
done
install -D -m 0644 -t "$work/$cli/apps/cli/man" "$root"/apps/cli/man/{zimanyar,zimanyar-lsp}.1
install -D -t "$work/$cli/packaging/cli" "$root/packaging/cli/zimanyar-lsp"
orig "$cli" "zimanyar-cli_$version.orig.tar.xz"
cp -r "$root/debian" "$work/$cli/"
echo "3.0 (quilt)" > "$work/$cli/debian/source/format"

desktop="zimanyar-$version"
for arch in amd64 arm64; do
  mkdir -p "$work/$desktop/prebuilt"
  dpkg-deb -x "$assets/zimanyar_${version}_$arch.deb" "$work/$desktop/prebuilt/$arch"
  rm -rf "$work/$desktop/prebuilt/$arch/usr/share/doc"
done
orig "$desktop" "zimanyar_$version.orig.tar.xz"
cp -r "$root/packaging/ppa/desktop/debian" "$work/$desktop/"
cp "$root/packaging/linux/copyright" "$work/$desktop/debian/copyright"
cp "$root/packaging/linux/changelog" "$work/$desktop/debian/changelog"

maintainer="$(sed -n 's/^Maintainer: //p' "$root/debian/control")"
for series in "$@"; do
  for tree in "$cli" "$desktop"; do
    package="${tree%-"$version"}"
    dir="$work/$series/$tree"
    mkdir -p "$work/$series"
    cp -r "$work/$tree" "$dir"
    cp "$out/${package}_$version.orig.tar.xz" "$work/$series/"
    {
      printf '%s (%s-0ppa%s~%s1) %s; urgency=medium\n\n' "$package" "$version" "$revision" "$series" "$series"
      printf '  * Zimanyar %s for Ubuntu %s, from the files of the GitHub release.\n\n' "$version" "$series"
      printf ' -- %s  %s\n\n' "$maintainer" "$(LC_ALL=C date -R)"
      cat "$work/$tree/debian/changelog"
    } > "$dir/debian/changelog"
    # -sa puts the orig tarball in every upload, so the order in which Launchpad takes them does not matter.
    (cd "$dir" && dpkg-buildpackage -S -sa -d "${sign[@]}" > "$work/$series/$package.log" 2>&1) ||
      { cat "$work/$series/$package.log" >&2; exit 1; }
    cp "$work/$series/${package}_$version-0ppa$revision~${series}1"{.dsc,.debian.tar.xz,_source.changes,_source.buildinfo} "$out/"
  done
done

echo "Source packages in $out. Upload with:"
for series in "$@"; do
  for package in zimanyar-cli zimanyar; do
    echo "  dput $ppa $out/${package}_$version-0ppa$revision~${series}1_source.changes"
  done
done
