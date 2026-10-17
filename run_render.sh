#!/bin/bash
# resumable (render_seq skips existing PNGs); frames in /workspace/tmp-m1clip (temp, deleted after packaging)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; W=/workspace/wechat-game/team/cinematic/work; O=/workspace/tmp-m1clip
for job in "before r24" "after r24" "before portrait45" "after portrait45"; do set -- $job
  if [ $1 = before ]; then bl=$W/m1v2/scene/cine_m1_anim.blend; sd=$W/m1v2/scripts; else bl=$PWD/pipe/scene/cine_m1_anim.blend; sd=$PWD/pipe/scripts; fi
  n=$(ls $O/$1 2>/dev/null | grep -c "^$2_"); [ "$n" -ge 136 ] && continue
  echo "$(date '+%F %T') START render $1 $2 (have $n)" >> STATUS.log
  for try in 1 2 3; do $B -b --python scripts/render_seq.py -- $bl $sd $O/$1 $2 >> $O/render_$1_$2.log 2>&1 && break; done
  echo "$(date '+%F %T') END render $1 $2 $(ls $O/$1 | grep -c "^$2_")" >> STATUS.log
done
echo RENDERDONE >> STATUS.log
