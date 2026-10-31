#!/usr/bin/env bash
# Reject commit messages that credit an AI assistant or a bot (CLAUDE.md, Attribution).
# Used by the lefthook commit-msg hook and by the contributors-guard workflow.
#
#   scripts/release/verify-attribution.sh MESSAGE_FILE
set -euo pipefail
(($# == 1)) || { echo "usage: $0 MESSAGE_FILE" >&2; exit 2; }

# Comment lines are dropped by git before the commit is made.
message="$(grep -v '^#' -- "$1" || true)"

forbidden=(
  'co-authored-by:.*(claude|anthropic|openai|chatgpt|copilot|dependabot|renovate|github-actions|\[bot\])'
  'generated (with|by) \[?(claude|ai|chatgpt|copilot)'
  'noreply@anthropic\.com'
)
for pattern in "${forbidden[@]}"; do
  if grep -qiE -- "$pattern" <<<"$message"; then
    echo "commit message credits an AI assistant or a bot (matched: $pattern)" >&2
    echo "Zimanyar commits carry the maintainer's identity only; see CLAUDE.md." >&2
    exit 1
  fi
done
