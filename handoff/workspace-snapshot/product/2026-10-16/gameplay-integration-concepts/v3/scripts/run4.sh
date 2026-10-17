#!/bin/bash
V=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/v3; B=/home/box/apps/blender-5.2.2-linux-x64/blender
idle(){ q=0; while [ $q -lt 60 ]; do if pgrep -x blender >/dev/null || pgrep -f "/blender -b" >/dev/null; then q=0; else q=$((q+5)); fi; sleep 5; done; }
for S in "$@"; do
  idle
  $B -b -t 6 -P $V/scripts/gic3.py -- $S $V/raw_$S.png > $V/scripts/log_$S.txt 2>&1
  python3 $V/../scripts/post2.py $V/raw_$S.png $V/$S.png >> $V/scripts/log_$S.txt 2>&1
  echo "$S $(date +%T)" >> $V/scripts/status.txt
done
echo "QUEUE_END $*" >> $V/scripts/status.txt
