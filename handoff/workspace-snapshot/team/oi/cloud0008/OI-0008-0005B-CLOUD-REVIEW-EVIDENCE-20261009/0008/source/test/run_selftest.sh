#!/usr/bin/env bash
# Runs every Linux-side self-test and writes outputs to selftest/. Needs miniprogram-automator (QF_MINIPROGRAM_AUTOMATOR_MODULE).
set -u
cd "$(dirname "$0")/.."
OUT=selftest; rm -rf "$OUT"; mkdir -p "$OUT"
{ echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "node=$(node -v)"; echo "platform=$(uname -sm)";
  echo "automator=$(node -p "require('${QF_MINIPROGRAM_AUTOMATOR_MODULE:-miniprogram-automator}/package.json').version" 2>&1)"; } > "$OUT/env.txt"
rc=0
: > "$OUT/syntax-check.txt"
for f in tools/*.cjs tools/*.js test/*.cjs test/fake-automator-server/*.cjs; do
  if node --check "$f" 2>>"$OUT/syntax-check.txt"; then echo "PASS $f" >> "$OUT/syntax-check.txt"; else echo "FAIL $f" >> "$OUT/syntax-check.txt"; rc=1; fi
done
QF_UNIT_RESULT="$OUT/unit-condition-result.json" node test/test_first_open_condition.cjs > "$OUT/unit-condition.txt" 2>&1 || rc=1
node test/test_shim.cjs > "$OUT/unit-shim.txt" 2>&1 || rc=1
node test/test_first_open_audit_dryrun.cjs "$OUT/dryrun" > "$OUT/dryrun.txt" 2> "$OUT/dryrun-stderr.log" || rc=1
echo "overall_exit=$rc" >> "$OUT/env.txt"
exit $rc
