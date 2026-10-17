#!/bin/bash
D=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts
while [ ! -f /workspace/wechat-game/art/regions/lakeside/renders/lakeside_r5h3_demo_8s.mp4 ]; do sleep 30; done
q=0; while [ $q -lt 120 ]; do if pgrep -x blender >/dev/null; then q=0; else q=$((q+10)); fi; sleep 10; done
for S in A_rail_crates B_snow_starmap C_cloud_terrace D_hill_picnic E_station_mailwall; do
  [ -f $D/$S.png ] && continue
  blender -b -t 4 -P $D/scripts/gic.py -- $S $D/raw_$S.png > $D/scripts/log_$S.txt 2>&1 && python3 $D/scripts/post.py $D/raw_$S.png $D/$S.png
done
echo ALL_RENDERED > $D/scripts/run_status.txt
