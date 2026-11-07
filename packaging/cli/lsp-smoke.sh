#!/usr/bin/env bash
# Talk to a language server as an editor would: open a document with a mistake, expect a diagnostic,
# a hover and a quick fix, then shut it down. Usage: lsp-smoke.sh COMMAND [ARGS...]
set -euo pipefail
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail() { echo "language server smoke test failed: $*" >&2; exit 1; }

# A message with its header. Content-Length counts bytes.
send() { printf 'Content-Length: %d\r\n\r\n%s' "$(printf '%s' "$1" | wc -c)" "$1"; }
uri="file:///tmp/a.txt"
range='{"start":{"line":0,"character":9},"end":{"line":0,"character":9}}'
{
  send '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}'
  send '{"jsonrpc":"2.0","method":"initialized","params":{}}'
  send "{\"jsonrpc\":\"2.0\",\"method\":\"textDocument/didOpen\",\"params\":{\"textDocument\":{\"uri\":\"$uri\",\"languageId\":\"plaintext\",\"version\":1,\"text\":\"Min tu dîtim.\"}}}"
  sleep 5
  send "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"textDocument/hover\",\"params\":{\"textDocument\":{\"uri\":\"$uri\"},\"position\":{\"line\":0,\"character\":9}}}"
  send "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"textDocument/codeAction\",\"params\":{\"textDocument\":{\"uri\":\"$uri\"},\"range\":$range,\"context\":{\"diagnostics\":[]}}}"
  sleep 2
  send '{"jsonrpc":"2.0","id":4,"method":"shutdown"}'
  send '{"jsonrpc":"2.0","method":"exit"}'
} | timeout 60 "$@" > "$work/out" || fail "the server exited with $?"
grep -q '"serverInfo":{"name":"zimanyar-lsp"' "$work/out" || fail "no answer to initialize"
grep -q '"code":"kmr.ergative.agreement"' "$work/out" || fail "no diagnostic"
grep -q 'In the past this verb agrees with the object' "$work/out" || fail "no hover"
grep -q '"newText":"dîtî"' "$work/out" || fail "no quick fix"
echo "the language server publishes diagnostics, hovers and quick fixes, and shuts down cleanly"
