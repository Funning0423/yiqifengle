#!/bin/bash
# usage: gate_run.sh <tag> <shots> <samples>   (waits for D_refine_r3/DONE + 120 s without any blender process)
TAG=$1; SHOTS=$2; SMP=${3:-32}; D=/workspace/wechat-game/product/2026-10-17/rainbow-bridge
BL=/home/box/apps/blender-5.2.2-linux-x64/blender
while [ ! -f /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/D_refine_r3/DONE ]; do sleep 20; done
quiet=0
while pgrep -f "blender-5.2.2-linux-x64/blender" >/dev/null; do sleep 1; done
echo "START $(date) $TAG" > $D/qa/run_$TAG.status
$BL -b --python $D/scripts/rb.py -- $D/renders $SHOTS $SMP > $D/qa/run_$TAG.log 2>&1
echo "EXIT $? $(date)" >> $D/qa/run_$TAG.status
# (appended) plan-B board-camera verification, same Blender slot
if [ "$TAG" = "full" ]; then $BL -b --python $D/scripts/sky_verify.py -- $D/qa/sky_b.json $D/renders > $D/qa/run_skyverify.log 2>&1; echo "SKY EXIT $? $(date)" >> $D/qa/run_$TAG.status; fi
