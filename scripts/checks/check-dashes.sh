#!/usr/bin/env bash
# Fail on em dashes, en dashes and their look-alikes (CLAUDE.md, Writing).
#
#   scripts/checks/check-dashes.sh            every tracked and untracked, not ignored file
#   scripts/checks/check-dashes.sh FILE...    only these files (used for commit messages)
#
# Forbidden: U+2010 to U+2015 (hyphens, figure dash, en dash, em dash, horizontal bar),
# U+2212 minus sign, U+2E3A and U+2E3B (two and three em dash), U+FE58 small em dash,
# U+FE63 small hyphen-minus, U+FF0D fullwidth hyphen-minus, U+2500 to U+257F box drawing.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PATTERN='[\x{2010}-\x{2015}\x{2212}\x{2E3A}\x{2E3B}\x{FE58}\x{FE63}\x{FF0D}\x{2500}-\x{257F}]'

if (($# > 0)); then
  if grep -nHIP "$PATTERN" -- "$@"; then
    echo "found dashes or box-drawing characters (see CLAUDE.md, Writing)" >&2
    exit 1
  fi
  exit 0
fi

cd "$ROOT"
if git grep --untracked -nIP "$PATTERN" -- . ':!LICENSE'; then
  echo "found dashes or box-drawing characters (see CLAUDE.md, Writing)" >&2
  exit 1
fi
