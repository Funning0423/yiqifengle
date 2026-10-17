#!/bin/bash
# usage: run2.sh S1 S2 ...   (one blender at a time; waits for idle)
D=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts; B=/home/box/apps/blender-5.2.2-linux-x64/blender
for S in "$@"; do
  while pgrep -x blender >/dev/null || pgrep -f "blender-5.2.2.*/blender " >/dev/null; do sleep 15; done
  $B -b -t 6 -P $D/scripts/gic2.py -- $S $D/raw_$S.png > $D/scripts/log_$S.txt 2>&1
  python3 $D/scripts/post2.py $D/raw_$S.png $D/$S.png >> $D/scripts/log_$S.txt 2>&1
  echo "$S $(date +%T)" >> $D/scripts/run2_status.txt
done
