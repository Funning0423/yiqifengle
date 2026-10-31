#!/usr/bin/env bash
# PRODUCTION UPLOAD build (提交审核 / 正式版) — the ONLY sanctioned path for a production upload.
# Refuses unless FORMAL_RELEASE=1 is set explicitly (no default) and probes are stripped; then runs
# build-wechat-guarded.sh wechat with FORMAL_RELEASE=1 STRIP_PROBES=1 (strip-probes --formal + release-gates --formal-free)
# and re-checks the final output (release-gates --probe-free + --formal-free) before printing PRODUCTION UPLOAD READY.
# Trial uploads (体验版, qfPre=3 entry kept) keep using build-wechat-guarded.sh with the default FORMAL_RELEASE=0.
# Gate: tools/build-guard/test_production_upload.cjs (suite key production-upload-formal).
set -u
HERE=$(cd "$(dirname "$0")" && pwd); REPO=${REPO_ROOT:-$(cd "$HERE/../.." && pwd)}; NODE=${NODE:-node}
refuse(){ echo "PRODUCTION UPLOAD REFUSED: $*"; exit 2; }
[ "${FORMAL_RELEASE:-}" = 1 ] || refuse "FORMAL_RELEASE=1 is required for a production upload (got '${FORMAL_RELEASE:-unset}'); trial uploads use build-wechat-guarded.sh"
[ "${STRIP_PROBES:-1}" = 1 ] || refuse "STRIP_PROBES must be 1 for a production upload (got '$STRIP_PROBES')"
[ "${1:-wechat}" = wechat ] || refuse "production upload target is wechat only (got '$1')"
FORMAL_RELEASE=1 STRIP_PROBES=1 bash "$HERE/build-wechat-guarded.sh" wechat || refuse "build guard failed"
OUT="$REPO/creator-build-project/build/wechat-release"
[ -d "$OUT" ] || refuse "no output at $OUT"
"$NODE" "$HERE/release-gates.cjs" --probe-free "$OUT" || refuse "probe code in production output"
"$NODE" "$HERE/release-gates.cjs" --formal-free "$OUT" || refuse "trial entry (qfPre / __qfPreTransition) in production output"
echo "PRODUCTION UPLOAD READY (FORMAL_RELEASE=1): upload $OUT"
