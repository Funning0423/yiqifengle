#!/bin/bash
# one blender at a time: wait for 60 s continuous no-blender before each render
D=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts; B=/home/box/apps/blender-5.2.2-linux-x64/blender
idle(){ q=0; while [ $q -lt 60 ]; do if pgrep -x blender >/dev/null || pgrep -f "/blender -b" >/dev/null; then q=0; else q=$((q+5)); fi; sleep 5; done; }
for S in "$@"; do
  idle
  $B -b -t 6 -P $D/scripts/gic2.py -- $S $D/raw_$S.png > $D/scripts/log_$S.txt 2>&1
  python3 $D/scripts/post2.py $D/raw_$S.png $D/$S.png >> $D/scripts/log_$S.txt 2>&1
  echo "$S $(date +%T)" >> $D/scripts/run2_status.txt
done
echo "QUEUE_END $*" >> $D/scripts/run2_status.txt
