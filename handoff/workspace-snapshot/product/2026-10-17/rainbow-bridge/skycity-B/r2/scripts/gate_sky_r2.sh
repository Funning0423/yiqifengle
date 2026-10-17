#!/bin/bash
D=/workspace/wechat-game/product/2026-10-17/rainbow-bridge; BL=/home/box/apps/blender-5.2.2-linux-x64/blender
while pgrep -f "blender-5.2.2-linux-x64/blender" >/dev/null; do sleep 2; done
echo "START $(date)" > $D/qa/run_sky_r2.status
$BL -b -t 4 --python $D/scripts/sky_verify_r2.py -- $D/skycity-B/r2/sky_b2_verify.json $D/renders > $D/qa/run_sky_r2.log 2>&1
echo "EXIT $? $(date)" >> $D/qa/run_sky_r2.status
