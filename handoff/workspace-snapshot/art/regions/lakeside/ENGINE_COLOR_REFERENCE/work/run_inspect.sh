#!/bin/bash
B=/home/box/apps/blender-5.2.2-linux-x64/blender; D=/workspace/wechat-game/art/regions/lakeside
cd $D/ENGINE_COLOR_REFERENCE/work
[ -s inspect_r5h3.json ] && grep -q '"objects"' inspect_r5h3.json && { echo already; exit 0; }
idle=0
while [ $idle -lt 120 ]; do
  if pgrep -f 'blender-5.2.2.*/blender' >/dev/null || pgrep -f run2.sh >/dev/null || pgrep -f bamrun >/dev/null; then idle=0; else idle=$((idle+5)); fi
  sleep 5
done
echo "start $(date)"
$B -b $D/blend/lakeside_r5h3.blend -P inspect_r5h3.py -- inspect_r5h3.json > inspect_log.txt 2>&1
echo "done $(date) $?"
