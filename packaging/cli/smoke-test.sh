#!/usr/bin/env bash
# Run the installed zimanyar as a developer would in CI (user story 6), and the other commands once.
# Needs only the installed program: no Node, no repository.
set -euo pipefail
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail() { echo "smoke test failed: $*" >&2; exit 1; }

cat > "$work/README.ku.md" <<'MD'
# Zimanyar

Min tu dîtim. Ez diçim malê.

```sh
zimanyar check README.ku.md
```
MD
status=0
zimanyar check --lang kmr --format json "$work/README.ku.md" > "$work/report.json" || status=$?
[ "$status" = 1 ] || fail "check exited with $status, not 1, on a file with an error"
grep -q '"ruleId": "kmr.ergative.agreement"' "$work/report.json" || fail "the JSON report has no agreement finding"
grep -q '"line": 3' "$work/report.json" || fail "the finding is not on line 3"
echo "check finds the error, exits with 1 and prints JSON"

echo "Ez diçim malê." | zimanyar check > /dev/null || fail "check exited with $?, not 0, on correct text"
echo "check exits with 0 on correct text"

status=0
zimanyar check --format nonsense - < /dev/null 2> /dev/null || status=$?
[ "$status" = 2 ] || fail "a bad option exited with $status, not 2"
echo "a usage error exits with 2"

zimanyar check --format sarif "$work/README.ku.md" > "$work/report.sarif" || true
grep -q '"version": "2.1.0"' "$work/report.sarif" || fail "no SARIF report"
[ "$(zimanyar translit کوردستان)" = "kurdistan" ] || fail "translit"
zimanyar conjugate dîtin | grep -q dibînim || fail "conjugate"
zimanyar lesson 14 --lang kmr | grep -q 'ergativity' || fail "lesson"
# Minimal container images tell dpkg to skip manuals, so ask the package rather than the disk.
dpkg -L zimanyar-cli | grep -q '/usr/share/man/man1/zimanyar.1.gz' || fail "no man page"
echo "the other commands, the SARIF report and the man page work"
