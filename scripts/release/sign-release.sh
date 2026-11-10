#!/usr/bin/env bash
# Finish the draft release that the Release workflow made for vX.Y.Z (RELEASING.md, step 8):
# download every asset, check it against SHA256SUMS and its provenance attestation, sign
# SHA256SUMS with the maintainer's key, upload the signature and publish the release.
#
#   make release-sign V=X.Y.Z
set -euo pipefail
version="${1:?usage: sign-release.sh X.Y.Z}"
tag="v$version"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

[[ "$(gh release view "$tag" --json isDraft --jq .isDraft)" == true ]] || { echo "sign-release: $tag is not a draft" >&2; exit 1; }
gh release download "$tag" --dir "$work"
cd "$work"
rm -f SHA256SUMS.sig
sha256sum --check --strict SHA256SUMS
listed="$(awk '{ print $2 }' SHA256SUMS | sed 's/^\*//' | sort)"
present="$(find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort)"
[[ "$listed" == "$present" ]] || { echo "sign-release: the assets and SHA256SUMS do not match" >&2; exit 1; }
# gh attestation arrived in gh 2.49; older versions can only ask the API whether an attestation exists.
if gh attestation --help > /dev/null 2>&1; then
  while read -r file; do
    gh attestation verify "$file" --repo "$repo" > /dev/null
    echo "$file: attested"
  done <<< "$listed"
else
  echo "sign-release: gh $(gh --version | awk 'NR == 1 { print $3 }') has no gh attestation; checking that attestations exist, not their signatures" >&2
  while read -r digest file; do
    count="$(gh api "repos/$repo/attestations/sha256:$digest" --jq '.attestations | length')"
    [[ "$count" -ge 1 ]] || { echo "sign-release: $file has no attestation" >&2; exit 1; }
    echo "$file: attestation found"
  done < SHA256SUMS
fi
gpg --detach-sign --output SHA256SUMS.sig SHA256SUMS
gpg --verify SHA256SUMS.sig SHA256SUMS
gh release upload "$tag" SHA256SUMS.sig --clobber --repo "$repo"
gh release edit "$tag" --draft=false --latest --repo "$repo"
echo "$tag is published"
