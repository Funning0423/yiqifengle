#!/bin/bash
# v3 resumable renders: v2g / pass2c SRC / cs2 at portrait45 + r24 (frames in /workspace/tmp-m1clip, deleted after packaging)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; W=/workspace/wechat-game/team/cinematic/work; O=/workspace/tmp-m1clip
job(){ v=$1; cam=$2
  case $v in v2g) bl=$W/m1v2/scene/cine_m1_anim.blend; sd=$W/m1v2/scripts;; src) bl=$PWD/pipe/scene/cine_m1_anim.blend; sd=$PWD/pipe/scripts;; *) bl=$PWD/pipe/scene/cine_m1_anim_$v.blend; sd=$PWD/pipe/scripts;; esac
  n=$(ls $O/$v 2>/dev/null | grep -c "^${cam}_"); [ "$n" -ge 136 ] && return
  echo "$(TZ=America/New_York date '+%F %T') START render v3 $v $cam (have $n)" >> STATUS.log
  for try in 1 2 3; do $B -b --python scripts/render_seq.py -- $bl $sd $O/$v $cam >> $O/render_${v}_$cam.log 2>&1 && break; done
  echo "$(TZ=America/New_York date '+%F %T') END render v3 $v $cam $(ls $O/$v | grep -c "^${cam}_")" >> STATUS.log; }
mkdir -p $O
for cam in portrait45 r24; do job v2g $cam & job src $cam & job cs2 $cam & wait; done
echo RENDERDONE_V3 >> STATUS.log
