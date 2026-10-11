#!/usr/bin/env bash
# T1 共享电脑（Linux CPU）全量复跑。只写 $SCRATCH；不触碰 mac-source / 任何工程。
# 依赖（均为既有交接资料或一次性下载，非生产）：
#   YQ=/workspace/yiqifengle（交接根）；cc-3.8.8 CPU 引擎与 typescript 来自 character-core；
#   NODE23（wiring 测试需 module.stripTypeScriptTypes）、QF_CANVAS_MODULE（@napi-rs/canvas）、CCTYPES（@cocos/creator-types@3.8.8 cc.d.ts）可选。
set -euo pipefail
G=$(cd "$(dirname "$0")/../.." && pwd); T=$G/tools/t1; C=$G/candidates/T1-lighthouse-return-baseline
YQ=${YQ:-/workspace/yiqifengle}; SCRATCH=${SCRATCH:-/tmp/ggbot-t1-run}; R=$SCRATCH/results; S=creator-build-project/assets/scripts
QA=$YQ/qa-supplement/oi-frozen-qa-supplement-20261011/lighthouse-return-audit
export ROOM_COCOS_CPU=$YQ/character-core/character-r23-anatomy-rebuild/stop-blend-stage/tools/cocos_exotic_cpu.cjs
export ROOM_TYPESCRIPT=$YQ/character-core/lighthouse-island-astra-ultra/tools/vendor-node/node_modules/typescript
rm -rf "$SCRATCH"; mkdir -p "$R"; cp -a "$QA" "$SCRATCH/qa"; export T1_FIXTURE=$SCRATCH/qa/extracted/island-lighthouse-return/tools/fixture.cjs
step(){ echo "== $*"; }
step "trees (git archive baseline 1ef9f1d / near)"
mkdir -p "$SCRATCH/trees/base" "$SCRATCH/trees/near"; git -C "$G" archive 1ef9f1d | tar x -C "$SCRATCH/trees/base"; git -C "$G" archive near | tar x -C "$SCRATCH/trees/near"
for t in base near; do mkdir -p "$SCRATCH/trees/$t-min/creator-build-project/assets/bundles/region_island"; cp -a "$SCRATCH/trees/$t/$S" "$SCRATCH/trees/$t/$S.meta" "$SCRATCH/trees/$t-min/creator-build-project/assets/" 2>/dev/null || true; cp "$SCRATCH/trees/$t/creator-build-project/assets/bundles/region_island/combined_visual_m.glb" "$SCRATCH/trees/$t-min/creator-build-project/assets/bundles/region_island/"; done
step "package integrity + candidate reproducible from baseline"
python3 "$T/build_candidate.py" "$SCRATCH/trees/base" "$SCRATCH/rebuilt" >/dev/null; diff -r "$C" "$SCRATCH/rebuilt" && echo "candidate byte-identical rebuild OK"
step "installer scenarios"; python3 "$T/test_candidate_installer.py" "$C" "$SCRATCH/trees/base-min" "$SCRATCH/trees/near-min" "$SCRATCH/inst" > "$R/final-candidate-installer.json"; python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['pass'],d['total'],d['failed'])" "$R/final-candidate-installer.json"
step "frozen-installer path counterexamples (reference)"; python3 "$T/test_installer_paths.py" "$SCRATCH/qa/extracted/island-lighthouse-return/variants/room-hud" "$SCRATCH/qa/independent-inputs/room-hud" "$T/apply_v2.py" "$SCRATCH/inst-frozen" > "$R/frozen-vs-v2-paths.json"
for v in l123 l12; do rm -rf "$SCRATCH/full-$v"; cp -a "$SCRATCH/trees/base" "$SCRATCH/full-$v"; python3 "$C/variants/baseline-$v/apply.py" "$SCRATCH/full-$v" >/dev/null; done
WB=$SCRATCH/full-l123/$S/WarmButton.ts
step "multi-touch dispatch (real 3.8.8 minigame touch source)"
for v in l123 l12; do for r in "" --raw-wx; do o=$R/final-mt-$v${r:+-rawwx}.json; node "$T/test_multitouch_dispatch.cjs" "$SCRATCH/full-$v/$S/world-r2/IslandHomeInteraction.ts" "$WB" $r > "$o" || true; python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(sys.argv[2],sum(x['pass'] for x in d['rows']),'/',len(d['rows']),[x['case'] for x in d['rows'] if not x['pass']])" "$o" "$v$r"; done; done
step "L3 lifecycle"; for v in l123 l12; do node "$T/test_l3_lifecycle.cjs" "$SCRATCH/full-$v/$S/world-r2/IslandHomeInteraction.ts" > "$R/final-l3-$v.json"; echo "$v ok"; done
step "author 13 event checks"; E=$SCRATCH/evt; mkdir -p "$E/tools" "$E/evidence" "$E/source/$S/world-r2" "$SCRATCH/room-look-work/tools"; cp "$SCRATCH/qa/extracted/island-lighthouse-return/tools/test_events.cjs" "$E/tools/"; cp "$T1_FIXTURE" "$SCRATCH/room-look-work/tools/"
for v in l123 l12; do cp "$SCRATCH/full-$v/$S/world-r2/IslandHomeInteraction.ts" "$E/source/$S/world-r2/"; node "$E/tools/test_events.cjs" >/dev/null; mv "$E/evidence/event-tests.json" "$R/final-ev-$v.json"; python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(sys.argv[2],d['pass'],len(d['checks']))" "$R/final-ev-$v.json" $v; done
step "geometry fixture"; (cd "$G/tools/vendor-node" && [ -d node_modules/draco3d ] || npm ci --no-audit --no-fund >/dev/null)
GLB=$SCRATCH/full-l123/creator-build-project/assets/bundles/region_island/combined_visual_m.glb
node "$T/decode_pick_geometry.cjs" "$GLB" "$SCRATCH/dec.json" >/dev/null; python3 "$T/check_fixture_identity.py" "$T/results/pick-geometry-baseline.identity.json" "$GLB" "$SCRATCH/dec.json"
if python3 "$T/check_fixture_identity.py" "$T/results/pick-geometry-baseline.identity.json" "$SCRATCH/trees/near/creator-build-project/assets/bundles/region_island/combined_visual_m.glb"; then echo "NEGATIVE CONTROL FAILED"; exit 1; else echo "stale-GLB negative control rejects OK"; fi
GE=$SCRATCH/geo; mkdir -p "$GE/tools" "$GE/evidence" "$GE/source/$S/world-r1"; cp "$SCRATCH/qa/extracted/island-lighthouse-return/tools/test_geometry.cjs" "$GE/tools/"; cp "$SCRATCH/full-l123/$S/world-r1/"{CameraPose,RegionCameraData,WorldFlowComponent}.ts "$GE/source/$S/world-r1/"
python3 "$T/to_author_pick_format.py" "$SCRATCH/dec.json" "$GE/evidence/pick-geometry.json"; node "$GE/tools/test_geometry.cjs" >/dev/null; cp "$GE/evidence/geometry-tests.json" "$R/final-geometry-l123.json"
python3 -c "import json,sys;d=json.load(open(sys.argv[1]));r=d['rows'];print('geometry',d['pass'],sum(x['gridHits']+x['gridMisses'] for x in r),sum(x['actualAabbAirMisses'] for x in r))" "$R/final-geometry-l123.json"
if [ -n "${NODE23:-}" ] && [ -n "${QF_CANVAS_MODULE:-}" ]; then step "author wiring (2 variants x 3 viewports)"; WI=$SCRATCH/wire; mkdir -p "$WI/tools" "$WI/evidence"; cp "$SCRATCH/qa/extracted/island-lighthouse-return/tools/test_wiring.cjs" "$WI/tools/"; ln -s "$SCRATCH/full-l123" "$WI/source"; ln -s "$SCRATCH/full-l12" "$WI/baseline-source"; (cd "$WI" && "$NODE23" tools/test_wiring.cjs 2>/dev/null | head -1); cp "$WI/evidence/wiring-tests.json" "$R/final-wiring-l123-l12.json"; else echo "== wiring SKIPPED (set NODE23 + QF_CANVAS_MODULE)"; fi
if [ -n "${CCTYPES:-}" ]; then step "tsc vs official cc.d.ts 3.8.8 (non-strict, like project tsconfig)"
 for t in trees/base full-l123 full-l12; do d=$SCRATCH/$t/creator-build-project; printf '{"compilerOptions":{"target":"ES2020","module":"ES2015","moduleResolution":"node","lib":["ES2020","DOM"],"experimentalDecorators":true,"strict":false,"noEmit":true,"skipLibCheck":true,"types":[],"allowSyntheticDefaultImports":true},"files":["%s"],"include":["assets/**/*.ts"]}' "$CCTYPES" > "$d/tsconfig.t1check.json"; (cd "$d" && node "$ROOM_TYPESCRIPT/bin/tsc" -p tsconfig.t1check.json > "$R/tsc-$(basename $t).txt" 2>&1 || true); rm "$d/tsconfig.t1check.json"; done
 norm(){ sed -E 's/\(([0-9]+),[0-9]+\)/(L)/' "$1" | grep 'error TS' | sort; }; for v in l123 l12; do if diff <(norm "$R/tsc-base.txt") <(norm "$R/tsc-full-$v.txt") >/dev/null; then echo "$v: 0 new TS errors (baseline has $(grep -c 'error TS' "$R/tsc-base.txt") pre-existing)"; else echo "$v: NEW TS ERRORS"; diff <(norm "$R/tsc-base.txt") <(norm "$R/tsc-full-$v.txt") || true; fi; done
else echo "== tsc SKIPPED (set CCTYPES=/path/@cocos/creator-types/engine/cc.d.ts)"; fi
step "exclusion: dev vendor / candidates are outside creator-build-project"
for p in tools/vendor-node candidates; do case "$(realpath "$G/$p")" in "$(realpath "$G/creator-build-project")"*) echo "FAIL $p inside project"; exit 1;; *) echo "OK $p outside creator-build-project";; esac; done
if find "$G/creator-build-project" -path '*/node_modules/*' -o -name 'draco_decoder*' | grep -q .; then echo "FAIL draco/node_modules under project"; exit 1; else echo "OK no node_modules/draco3d under creator-build-project"; fi
git -C "$G" check-ignore -q tools/vendor-node/node_modules && echo "OK vendor node_modules git-ignored (lockfile committed)"
echo "ALL BOX TESTS DONE → $R"
