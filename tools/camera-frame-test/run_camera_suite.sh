#!/usr/bin/env bash
# 运镜主测试一键跑（交接用）。在仓库根目录或任意目录运行均可：
#   bash tools/camera-frame-test/run_camera_suite.sh [LOG_DIR]
# 需要 node >= 20（box 上是 work/GGbot/tools/vendor-node 的 node 23.11）、QF_TYPESCRIPT_MODULE 指向 typescript、
# draco3d 1.5.7（DRACO3D=<目录> 或在 tools/camera-frame-test 下 npm i --no-save draco3d@1.5.7）。
# 并行跑：帧测试默认 / --real-walk / ES5 / ES5+real-walk，sit_timing，composition，es5_safety，turn_targets，wind_api，door_spill。
# 已知失败（不在这里跑）：--walk-profile accel，导航测试（见交接文档）。
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"
L=${1:-${TMPDIR:-/tmp}/camera-suite-$(date +%Y%m%d-%H%M%S)}; mkdir -p "$L"
T=tools/camera-frame-test
run(){ local name=$1; shift; ( env "$@" > "$L/$name.log" 2>&1; echo "exit $?" >> "$L/$name.log" ) & }
run frames-default        node $T/test_camera_frames.cjs
run frames-real-walk      node $T/test_camera_frames.cjs --real-walk
run frames-es5            QF_TS_TARGET=ES5 node $T/test_camera_frames.cjs
run frames-es5-real-walk  QF_TS_TARGET=ES5 node $T/test_camera_frames.cjs --real-walk
run sit_timing            node $T/test_sit_timing.cjs
run composition           node tools/cloud-island-camera/test_composition.cjs
run es5_safety            node $T/test_es5_safety.cjs
run turn_targets          node $T/test_turn_targets.cjs
run wind_api              node $T/test_wind_api.cjs
run door_spill            node $T/test_door_spill.cjs
wait
fail=0
for f in "$L"/*.log; do r=$(tail -1 "$f"); printf '%-24s %s\n' "$(basename "$f" .log)" "$r"; [ "$r" = "exit 0" ] || fail=1; done
echo "logs: $L"; exit $fail
