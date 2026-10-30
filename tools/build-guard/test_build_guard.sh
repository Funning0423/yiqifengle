#!/usr/bin/env bash
# Dry-run self-test for build-wechat-guarded.sh with a fake Creator (no Cocos needed). Runs on Linux and macOS bash 3.2.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); SCR=${QF_SCRATCH_ROOT:-$HOME/wt}; mkdir -p "$SCR"; T=$(mktemp -d "$SCR/qf-guard-test.XXXXXX"); trap 'rm -rf "$T"' EXIT
export QF_STAGE_ROOT=$T/stage PRELOAD_GATE=0 NODE=${NODE:-node}   # cases 1-10: build mechanics only; preload gate in cases 11-12
fail(){ echo "SELFTEST FAIL: $*"; exit 1; }
mkrepo(){ R=$T/repo$1; mkdir -p "$R/creator-build-project/assets/scripts" "$R/tools/build-guard"
  cp "$HERE/build-wechat-guarded.sh" "$HERE/wechat-release.json" "$HERE/web-test.json" "$HERE/strip-probes.cjs" "$HERE/release-gates.cjs" "$HERE/release-probe-symbols.json" "$HERE/meta-allowlist.cjs" "$HERE/meta-allowlist.json" "$HERE/manifest-files-exist.cjs" "$HERE/lib-gates.cjs" "$R/tools/build-guard/"
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
# 5) wechat release default: staged + stripped, gates pass, repo source untouched, diff proof written, release copied back
R=$(mkrepo 5); c=$(run "$R" wechat 5 "good"); cat "$T/out5"; [ "$c" = 0 ] || fail "case5 exit $c"
grep -q "RELEASE (probes stripped)" "$T/out5" && grep -q "PASS release-probe-free" "$T/out5" && grep -q "PASS release-size TOTAL=16000000" "$T/out5" || fail "case5 gates"
grep -q "PASS strip-probes prove changedFiles=1 regions=1" "$T/out5" || fail "case5 proof"; S5=$(cd "$R" && git rev-parse --short=7 HEAD)
grep -q "QF_PROBE_BEGIN" "$R/tools/build-guard/logs/strip-probes.$S5.diff" || fail "case5 diff file"; grep -q "__QF_PROBE_HER" "$R/creator-build-project/assets/scripts/probe.ts" || fail "case5 repo source changed"
! grep -q "QF_PROBE" "$R/creator-build-project/build/wechat-release/game.js" || fail "case5 release has probe"; [ -z "$(cd "$R" && git status --porcelain)" ] || fail "case5 dirty"
# 6) STRIP_PROBES=0 -> test build keeps probes, loudly labelled; web always keeps probes
R=$(mkrepo 6); c=$(STRIP_PROBES=0 run "$R" wechat 6 "good"); [ "$c" = 0 ] || fail "case6 exit $c"; grep -q "PROBES KEPT" "$T/out6" || fail "case6 label"
grep -q "__QF_PROBE_HER" "$R/creator-build-project/build/wechat-release/game.js" || fail "case6 probes missing in test build"
# 7) gate self-test on build output: the unstripped (case 6) output must FAIL probe-free; the stripped (case 5) must PASS
"$NODE" "$HERE/release-gates.cjs" --probe-free "$R/creator-build-project/build/wechat-release" >/dev/null && fail "case7 unstripped passed"
"$NODE" "$HERE/release-gates.cjs" --probe-free "$T/repo5/creator-build-project/build/wechat-release" >/dev/null || fail "case7 stripped failed"
# 8) size gate: release over MAX_MAIN_BYTES fails loudly; over MAX_TOTAL_BYTES too
R=$(mkrepo 8); c=$(MAX_MAIN_BYTES=2999999 run "$R" wechat 8 "good"); [ "$c" = 2 ] || fail "case8 exit $c"; grep -q "FAIL SIZE MAIN 3000000 > 2999999" "$T/out8" || fail "case8 main msg"
R=$(mkrepo 9); c=$(MAX_TOTAL_BYTES=15999999 run "$R" wechat 9 "good"); [ "$c" = 2 ] || fail "case9 exit $c"; grep -q "FAIL SIZE TOTAL" "$T/out9" || fail "case9 total msg"
# 10) unbalanced marker -> release refuses before building
R=$(mkrepo 10); printf '/*QF_PROBE_BEGIN*/x\n' >> "$R/creator-build-project/assets/scripts/probe.ts"; (cd "$R" && git -c user.email=t@t -c user.name=t commit -qam bad); c=$(run "$R" wechat 10 "good"); [ "$c" = 2 ] || fail "case10 exit $c"; grep -q "unclosed" "$T/out10" || fail "case10 msg"
# 11) preload gate on (STRIP_PROBES=0: size gate covered by 8/9): built bundles == committed PRELOAD_BYTES -> pass, table written; 12) 3 % drift -> loud fail
mkpre(){ R=$(mkrepo $1); mkdir -p "$R/tools/preload-size" "$R/creator-build-project/assets/scripts/region"; cp "$HERE/../preload-size/preload-bytes.cjs" "$R/tools/preload-size/"
  cp "$HERE/../../creator-build-project/assets/scripts/region/TransitionChain.ts" "$R/creator-build-project/assets/scripts/region/"; (cd "$R" && git add -A && git -c user.email=t@t -c user.name=t commit -qm pre); echo "$R"; }
R=$(mkpre 11); c=$(STRIP_PROBES=0 PRELOAD_GATE=1 FAKE_BUNDLES=1 run "$R" wechat 11 "good"); cat "$T/out11"; [ "$c" = 0 ] || fail "case11 exit $c"
grep -q "PASS preload-bytes gate 5 bundles" "$T/out11" || fail "case11 gate"; ls "$R"/tools/build-guard/logs/preload-bytes.wechat-release.*.md >/dev/null || fail "case11 table"
R=$(mkpre 12); c=$(STRIP_PROBES=0 PRELOAD_GATE=1 FAKE_BUNDLES=1.03 run "$R" wechat 12 "good"); [ "$c" = 2 ] || fail "case12 exit $c"
grep -q "FAIL DRIFT region_skycity" "$T/out12" && grep -q "PRELOAD_BYTES differ" "$T/out12" || fail "case12 msg"
# 13) committed .meta change not in the allowlist (vs base = first commit) -> refuse before building
R=$(mkrepo 13); (cd "$R" && printf '{"ver":"1.0.0","importer":"typescript","uuid":"u1","x":1}\n' > creator-build-project/assets/scripts/a1.ts.meta && git -c user.email=t@t -c user.name=t commit -qam meta)
c=$(META_BASE_OVERRIDE=HEAD~1 run "$R" wechat 13 "good"); [ "$c" = 2 ] || fail "case13 exit $c"; grep -q "NOT_ALLOWED .*a1.ts.meta add /x" "$T/out13" || fail "case13 msg"; grep -q "meta-allowlist gate failed" "$T/out13" || fail "case13 die"
# 14) manifest lists a missing file -> refuse before building
R=$(mkrepo 14); (cd "$R" && printf '[\n  {"path": "creator-build-project/assets/gone.glb"}\n]\n' > assets-MANIFEST-SHA256.json && git -c user.email=t@t -c user.name=t commit -qam man)
c=$(run "$R" wechat 14 "good"); [ "$c" = 2 ] || fail "case14 exit $c"; grep -q "MISSING_FILE .*gone.glb" "$T/out14" || fail "case14 msg"
# 15) placeholder gate (system-panels SPEC §1.4): dirty build sample (literal and \u-escaped) must fail, clean sample must pass
P=$T/ph; mkdir -p "$P/bad/build/wechatgame/src" "$P/esc/build/wechatgame" "$P/good/build/wechatgame/src" "$P/src/creator-build-project/assets"
W=$(printf '\345\215\240\344\275\215')
printf '{"t":"%s"}\n' "$W" > "$P/bad/build/wechatgame/src/settings.json"
printf 'var a="\\u5360\\u4f4d";\n' > "$P/esc/build/wechatgame/game.js"
printf '{"t":"ok"}\n' > "$P/good/build/wechatgame/src/settings.json"; head -c 64 /dev/urandom > "$P/good/build/wechatgame/x.png"
printf '// %s\n' "$W" > "$P/src/creator-build-project/assets/a.ts"
node "$HERE/check-no-placeholder.cjs" --root "$P/bad" > "$T/ph1" 2>&1 && fail "case15 literal hit passed"; grep -q "settings.json:1" "$T/ph1" || fail "case15 no path:line"
node "$HERE/check-no-placeholder.cjs" --root "$P/esc" > "$T/ph2" 2>&1 && fail "case15 escaped hit passed"
node "$HERE/check-no-placeholder.cjs" --root "$P/src" > "$T/ph3" 2>&1 && fail "case15 source comment hit passed"
node "$HERE/check-no-placeholder.cjs" --root "$P/good" > "$T/ph4" 2>&1 || { cat "$T/ph4"; fail "case15 clean sample failed"; }
node "$HERE/check-no-placeholder.cjs" --root "$HERE/../.." > "$T/ph5" 2>&1 || { cat "$T/ph5"; fail "case15 repo source has the placeholder word"; }
echo "SELFTEST PASS (15 cases + provenance)"
