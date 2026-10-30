#!/usr/bin/env bash
# Dry-run self-test for build-wechat-guarded.sh with a fake Creator (no Cocos needed). Runs on Linux and macOS bash 3.2.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); SCR=${QF_SCRATCH_ROOT:-$HOME/wt}; mkdir -p "$SCR"; T=$(mktemp -d "$SCR/qf-guard-test.XXXXXX"); trap 'rm -rf "$T"' EXIT
export PRELOAD_GATE=0 NODE=${NODE:-node}   # cases 1-4: build mechanics only; preload gate in cases 5-6
fail(){ echo "SELFTEST FAIL: $*"; exit 1; }
mkrepo(){ R=$T/repo$1; mkdir -p "$R/creator-build-project/assets/scripts" "$R/tools/build-guard"
  cp "$HERE/build-wechat-guarded.sh" "$HERE/wechat-release.json" "$HERE/web-test.json" "$R/tools/build-guard/"
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
if [ "$what" = good ]; then head -c 9000000 /dev/zero > "$P/build/$out/game.bin"; head -c 7000000 /dev/zero > "$P/build/$out/subpackages/main/m.bin"; echo "build Task Finished"; exit 36
else head -c 2300000 /dev/zero > "$P/build/$out/game.bin"; echo "Error: 当前初始场景不存在或在 Bundle 中，无法设置为初始场景。"
  for f in "$P"/assets/scripts/*.meta; do echo '{"ver":"0.0.1","importer":"*"}' > "$f"; done; echo '{}' > "$P/assets/scripts/new.ts.meta"; exit 36; fi
F
chmod +x "$T/fake-creator"
run(){ R=$1; shift; PLAN=$T/plan$2; printf '%s\n' $3 > "$PLAN"; rm -f "$PLAN.n"; export PLAN
  (cd "$R" && CREATOR=$T/fake-creator SKIP_CREATOR_CHECK=1 MAX_TRIES=3 bash tools/build-guard/build-wechat-guarded.sh $1) > "$T/out$2" 2>&1; echo $?; }
# 1) bad, bad, good -> pass on try 3, total printed, metas intact, caches gone
R=$(mkrepo 1); c=$(run "$R" wechat 1 "bad bad good"); cat "$T/out1"
[ "$c" = 0 ] || fail "case1 exit $c"; grep -q "try 3/3" "$T/out1" || fail "case1 no retry"; grep -q "TOTAL_BYTES=16000000" "$T/out1" || fail "case1 total"
grep -q "BUILD GUARD PASSED: wechat-release 16000000" "$T/out1" || fail "case1 summary"; [ -z "$(cd "$R" && git status --porcelain)" ] || fail "case1 dirty"
[ ! -d "$R/creator-build-project/library" ] && [ ! -d "$R/creator-build-project/temp" ] || fail "case1 caches left"
grep -q '"importer":"typescript"' "$R/creator-build-project/assets/scripts/a1.ts.meta" || fail "case1 meta not restored"
# 1b) provenance: HEAD/tree/UTC printed first and in each log; log name carries the short SHA; old name kept as a link
H=$(cd "$R" && git rev-parse HEAD); TR=$(cd "$R" && git rev-parse 'HEAD^{tree}'); S=$(cd "$R" && git rev-parse --short=7 HEAD)
head -1 "$T/out1" | grep -Eq "^== GUARD HEAD=$H tree=$TR short=$S utc=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z" || fail "case1b header"
L=$R/tools/build-guard/logs; [ -f "$L/wechat-release.$S.try3.log" ] || fail "case1b sha log name"; head -1 "$L/wechat-release.$S.try3.log" | grep -q "HEAD=$H tree=$TR" || fail "case1b log header"
[ -L "$L/wechat-release.try3.log" ] && grep -q "HEAD=$H" "$L/wechat-release.try3.log" || fail "case1b legacy log name"
# 2) bad x3 -> loud failure, exit 2, metas restored, caches gone
R=$(mkrepo 2); c=$(run "$R" wechat 2 "bad bad bad"); cat "$T/out2"
[ "$c" = 2 ] || fail "case2 exit $c"; grep -q "BUILD GUARD FAILED" "$T/out2" || fail "case2 not loud"; [ -z "$(cd "$R" && git status --porcelain)" ] || fail "case2 dirty"
[ ! -d "$R/creator-build-project/library" ] || fail "case2 cache"
# 3) dirty tree before build -> refuse
R=$(mkrepo 3); echo x >> "$R/creator-build-project/assets/scripts/a1.ts.meta"; c=$(run "$R" wechat 3 "good"); [ "$c" = 2 ] || fail "case3 exit $c"; grep -q "not clean before" "$T/out3" || fail "case3 msg"
# 4) both targets, each good first time
R=$(mkrepo 4); c=$(run "$R" both 4 "good good"); [ "$c" = 0 ] || fail "case4 exit $c"; grep -q "web-test 16000000" "$T/out4" || fail "case4 both"
# 5) preload gate on: built bundles == committed PRELOAD_BYTES -> pass, table written; 6) 3 % drift -> loud fail
mkpre(){ R=$(mkrepo $1); mkdir -p "$R/tools/preload-size" "$R/creator-build-project/assets/scripts/region"; cp "$HERE/../preload-size/preload-bytes.cjs" "$R/tools/preload-size/"
  cp "$HERE/../../creator-build-project/assets/scripts/region/TransitionChain.ts" "$R/creator-build-project/assets/scripts/region/"; (cd "$R" && git add -A && git -c user.email=t@t -c user.name=t commit -qm pre); echo "$R"; }
R=$(mkpre 5); c=$(PRELOAD_GATE=1 FAKE_BUNDLES=1 run "$R" wechat 5 "good"); cat "$T/out5"; [ "$c" = 0 ] || fail "case5 exit $c"
grep -q "PASS preload-bytes gate 5 bundles" "$T/out5" || fail "case5 gate"; ls "$R"/tools/build-guard/logs/preload-bytes.wechat-release.*.md >/dev/null || fail "case5 table"
R=$(mkpre 6); c=$(PRELOAD_GATE=1 FAKE_BUNDLES=1.03 run "$R" wechat 6 "good"); [ "$c" = 2 ] || fail "case6 exit $c"
grep -q "FAIL DRIFT region_skycity" "$T/out6" && grep -q "PRELOAD_BYTES differ" "$T/out6" || fail "case6 msg"
echo "SELFTEST PASS (6 cases + provenance)"
