#!/usr/bin/env bash
# Check every commit in a range for allowed author and committer identities and
# forbidden attribution, and the tree for bot configuration (CLAUDE.md, Attribution).
#
#   scripts/release/verify-contributors.sh RANGE      e.g. origin/develop..HEAD
#   scripts/release/verify-contributors.sh --all      the whole history of HEAD
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALLOWED_FILE="${ALLOWED_AUTHORS:-$ROOT/.github/allowed-authors.txt}"
(($# == 1)) || { echo "usage: $0 RANGE|--all" >&2; exit 2; }

range="$1"
[[ "$range" == "--all" ]] && range="HEAD"

mapfile -t allowed < <(grep -vE '^\s*(#|$)' "$ALLOWED_FILE")
is_allowed() {
  local email="${1,,}" a
  for a in "${allowed[@]}"; do [[ "$email" == "${a,,}" ]] && return 0; done
  return 1
}

failures=0
fail() { echo "error: $*" >&2; failures=$((failures + 1)); }
message_file="$(mktemp)"
trap 'rm -f "$message_file"' EXIT

while IFS=' ' read -r sha parents_count author committer; do
  short="${sha:0:10}"
  is_allowed "$author" || fail "$short: author <$author> is not in $(basename "$ALLOWED_FILE")"
  if ! is_allowed "$committer"; then
    # Merges made in the GitHub web interface are committed by GitHub itself.
    if [[ "$committer" == "noreply@github.com" && "$parents_count" -gt 1 ]]; then :
    else fail "$short: committer <$committer> is not in $(basename "$ALLOWED_FILE")"; fi
  fi
  git -C "$ROOT" log -1 --format=%B "$sha" >"$message_file"
  "$ROOT/scripts/release/verify-attribution.sh" "$message_file" 2>/dev/null \
    || fail "$short: commit message credits an AI assistant or a bot"
done < <(git -C "$ROOT" log --format='%H %p %ae %ce' "$range" \
  | awk '{ n = NF - 3; print $1, n, $(NF - 1), $NF }')

for path in .github/dependabot.yml .github/dependabot.yaml renovate.json renovate.json5 \
  .renovaterc .renovaterc.json .github/renovate.json .github/renovate.json5; do
  [[ -e "$ROOT/$path" ]] && fail "$path must not exist: dependency updates are made by the maintainer"
done

if ((failures > 0)); then
  echo "$failures contributor check(s) failed; see CLAUDE.md, Attribution" >&2
  exit 1
fi
echo "contributors ok"
