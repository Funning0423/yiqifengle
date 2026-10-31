#!/usr/bin/env bash
# Dry-run self-test for build-production-upload.sh (production upload must be FORMAL_RELEASE=1); fixture copied from test_build_guard.sh, with a fake Creator (no Cocos needed). Runs on Linux and macOS bash 3.2.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); SCR=${QF_SCRATCH_ROOT:-$HOME/wt}; mkdir -p "$SCR"; T=$(mktemp -d "$SCR/qf-guard-test.XXXXXX"); trap 'rm -rf "$T"' EXIT
export QF_STAGE_ROOT=$T/stage PRELOAD_GATE=0 NODE=${NODE:-node}   # cases 1-10: build mechanics only; preload gate in cases 11-12
fail(){ echo "SELFTEST FAIL: $*"; exit 1; }
mkrepo(){ R=$T/repo$1; mkdir -p "$R/creator-build-project/assets/scripts" "$R/tools/build-guard"
  cp "$HERE/build-wechat-guarded.sh" "${UPLOAD_SH:-$HERE/build-production-upload.sh}" "$HERE/wechat-release.json" "$HERE/web-test.json" "$HERE/strip-probes.cjs" "$HERE/release-gates.cjs" "$HERE/release-probe-symbols.json" "$HERE/meta-allowlist.cjs" "$HERE/meta-allowlist.json" "$HERE/manifest-files-exist.cjs" "$HERE/lib-gates.cjs" "$R/tools/build-guard/"
  printf 'export const a=1;/*QF_PROBE_BEGIN*/(globalThis as any).__QF_PROBE_HER=1;log("[QF_HER_FRAME] x");/*QF_PROBE_END*/\n' > "$R/creator-build-project/assets/scripts/probe.ts"
  printf '[]\n' > "$R/assets-MANIFEST-SHA256.json"; printf '[]' > "$R/text-MANIFEST-SHA256.json"
  printf 'build/\nlibrary/\ntemp/\ntools/build-guard/logs/\n' > "$R/.gitignore"
  for i in 1 2 3; do printf '{"ver":"1.0.0","importer":"typescript","uuid":"u%s"}\n' $i > "$R/creator-build-project/assets/scripts/a$i.ts.meta"; done
  (cd "$R" && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init) ; echo "$R"; }
# Fake Creator: plan file lists per-launch outcome (bad|good). bad = 2.3 MB, error line, metas rewritten + a stray meta.
cat > "$T/fake-creator" <<'F'
#!/usr/bin/env bash
P=""; C=""; while [ $# -gt 0 ]; do case "$1" in --project) P=$2; shift;; --build) C=${2#configPath=}; shift;; esac; shift; done
n=$(cat "$PLAN.n" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "$PLAN.n"; what=$(sed -n "${n}p" "$PLAN")
out=$(sed -n 's/.*"outputName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$C" | head -1)
mkdir -p "$P/build/$out/subpackages/main" "$P/library" "$P/temp"; echo cache > "$P/library/x"
if [ -n "${FAKE_BUNDLES:-}" ]; then "$NODE" -e 'const [b,o,s]=process.argv.slice(1),fs=require("fs");const blk=require(b+"/tools/preload-size/preload-bytes.cjs").readBlock(fs.readFileSync(b+"/creator-build-project/assets/scripts/region/TransitionChain.ts","utf8"));for(const [k,v] of Object.entries(blk.bytes)){fs.mkdirSync(o+"/subpackages/"+k,{recursive:true});fs.writeFileSync(o+"/subpackages/"+k+"/n.bin",Buffer.alloc(Math.round(v*s)));}' "$(dirname "$P")" "$P/build/$out" "$FAKE_BUNDLES"; fi
if [ "$what" = good ]; then { cat "$P"/assets/scripts/*.ts; head -c 3000000 /dev/zero | tr '\0' ' '; } | head -c 3000000 > "$P/build/$out/game.js"; head -c 13000000 /dev/zero > "$P/build/$out/subpackages/main/m.bin"; echo "build Task Finished"; exit 36
else head -c 2300000 /dev/zero > "$P/build/$out/game.bin"; echo "Error: 当前初始场景不存在或在 Bundle 中，无法设置为初始场景。"
  for f in "$P"/assets/scripts/*.meta; do echo '{"ver":"0.0.1","importer":"*"}' > "$f"; done; echo '{}' > "$P/assets/scripts/new.ts.meta"; exit 36; fi
F
chmod +x "$T/fake-creator"
run(){ R=$1; shift; export META_ALLOWLIST_BASE=${META_BASE_OVERRIDE:-HEAD}; PLAN=$T/plan$2; printf '%s\n' $3 > "$PLAN"; rm -f "$PLAN.n"; export PLAN
  (cd "$R" && CREATOR=$T/fake-creator SKIP_CREATOR_CHECK=1 MAX_TRIES=3 bash tools/build-guard/build-wechat-guarded.sh $1) > "$T/out$2" 2>&1; echo $?; }

up(){ R=$1; shift; export META_ALLOWLIST_BASE=HEAD; PLAN=$T/plan$1; printf 'good\n' > "$PLAN"; rm -f "$PLAN.n"; export PLAN
  (cd "$R" && CREATOR=$T/fake-creator SKIP_CREATOR_CHECK=1 MAX_TRIES=1 bash tools/build-guard/build-production-upload.sh) > "$T/out$1" 2>&1; echo $?; }
mkf(){ R=$(mkrepo "$1"); printf 'export const t=1;/*QF_TRIAL_BEGIN*/(globalThis as any).__qfPreTransition=1;/*QF_TRIAL_END*/\n' > "$R/creator-build-project/assets/scripts/trial.ts"
  (cd "$R" && git add -A && git -c user.email=t@t -c user.name=t commit -qm trial); echo "$R"; }
launched(){ [ -f "$T/plan$1.n" ]; }
# 1) FORMAL_RELEASE unset / 0 / yes -> refused before any Creator launch
for v in unset 0 yes; do n=1$v; R=$(mkf "$n"); if [ $v = unset ]; then c=$(env -u FORMAL_RELEASE bash -c "$(declare -f up); T=$T; up $R $n"); else c=$(FORMAL_RELEASE=$v up "$R" "$n"); fi
  [ "$c" != 0 ] || fail "case1 FORMAL_RELEASE=$v production upload ran"; grep -q "PRODUCTION UPLOAD REFUSED: FORMAL_RELEASE=1 is required" "$T/out$n" || fail "case1 $v message"; ! launched "$n" || fail "case1 $v launched Creator"; done
# 2) FORMAL_RELEASE=1 STRIP_PROBES=0 -> refused
R=$(mkf 2); c=$(FORMAL_RELEASE=1 STRIP_PROBES=0 up "$R" 2); [ "$c" != 0 ] || fail "case2 unstripped production upload ran"; ! launched 2 || fail "case2 launched Creator"
# 3) FORMAL_RELEASE=1 -> formal strip (strip-probes --formal), --formal-free in guard + re-check, output has no probe/trial entry
R=$(mkf 3); c=$(FORMAL_RELEASE=1 up "$R" 3); [ "$c" = 0 ] || { cat "$T/out3"; fail "case3 exit $c"; }
grep -q "FORMAL RELEASE (probes + trial entry stripped)" "$T/out3" || fail "case3 not a formal strip"
[ "$(grep -c "PASS release-formal-free" "$T/out3")" -ge 2 ] || fail "case3 --formal-free not run in guard + re-check"
[ "$(grep -c "PASS release-probe-free" "$T/out3")" -ge 2 ] || fail "case3 --probe-free not run in guard + re-check"
grep -q "PRODUCTION UPLOAD READY (FORMAL_RELEASE=1)" "$T/out3" || fail "case3 ready line"
! grep -q -e qfPre -e QF_TRIAL -e QF_PROBE "$R/creator-build-project/build/wechat-release/game.js" || fail "case3 output has trial/probe code"
# 4) negatives: a weakened upload script must be caught by cases 1/3
W=$T/weak; mkdir -p "$W"
sed '/FORMAL_RELEASE:-}" = 1 ] ||/d' "$HERE/build-production-upload.sh" > "$W/noassert.sh"
R=$(UPLOAD_SH=$W/noassert.sh mkf 41); cp "$W/noassert.sh" "$R/tools/build-guard/build-production-upload.sh"; (cd "$R" && git add -A && git -c user.email=t@t -c user.name=t commit -qm weak)
c=$(FORMAL_RELEASE=0 up "$R" 41); { [ "$c" != 0 ] && grep -q "PRODUCTION UPLOAD REFUSED: FORMAL_RELEASE=1 is required" "$T/out41"; } && fail "case4 negative: upload script without the FORMAL_RELEASE assert passed case1"
sed 's/FORMAL_RELEASE=1 STRIP_PROBES=1 bash/FORMAL_RELEASE=0 STRIP_PROBES=1 bash/; /--formal-free "\$OUT"/d' "$HERE/build-production-upload.sh" > "$W/noformal.sh"
R=$(mkf 42); cp "$W/noformal.sh" "$R/tools/build-guard/build-production-upload.sh"; (cd "$R" && git add -A && git -c user.email=t@t -c user.name=t commit -qm weak)
c=$(FORMAL_RELEASE=1 up "$R" 42); { [ "$c" = 0 ] && grep -q "FORMAL RELEASE (probes + trial entry stripped)" "$T/out42" && ! grep -q -e qfPre "$R/creator-build-project/build/wechat-release/game.js"; } && fail "case4 negative: upload script that drops FORMAL_RELEASE to the guard passed case3"
# 5) every upload/production script under tools/ goes through this guard (no second, unguarded upload path)
ROOT=$(cd "$HERE/../.." && pwd); bad=$(cd "$ROOT" && git ls-files tools | grep -E '\.(sh|cjs|mjs|js)$' | grep -v -E '^tools/build-guard/(build-production-upload\.sh|test_production_upload\.(sh|cjs))$' | while read -r f; do
  if grep -q -E 'miniprogram-ci|ci\.upload\(|cli(\.bat)? +upload|--upload-version' "$f" 2>/dev/null; then grep -q 'build-production-upload.sh' "$f" || echo "$f"; fi; done)
[ -z "$bad" ] || fail "case5 unguarded upload path(s): $bad"
printf 'const ci=require("miniprogram-ci");ci.upload({});\n' > "$T/rogue.cjs"; grep -q -E 'miniprogram-ci|ci\.upload\(' "$T/rogue.cjs" && ! grep -q build-production-upload.sh "$T/rogue.cjs" || fail "case5 negative fixture not detected"
echo "PASS production-upload-formal: refuses without FORMAL_RELEASE=1 (unset/0/yes) or with STRIP_PROBES=0 before Creator; FORMAL_RELEASE=1 -> strip-probes --formal, --probe-free + --formal-free in guard and re-check; weakened scripts caught; no unguarded upload script"
