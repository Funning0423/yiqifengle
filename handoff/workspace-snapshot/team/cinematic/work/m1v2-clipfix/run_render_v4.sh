#!/bin/bash
# v4 resumable renders: v2g + SRC+ease (full stand+turn), SRC (stand f0-15) at portrait45 + r24 -> /workspace/tmp-m1clip4 (deleted after packaging)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; W=/workspace/wechat-game/team/cinematic/work; O=/workspace/tmp-m1clip4
F15=$(for f in $(seq 0 15); do printf "cine_open_stand:%d," $f; done | sed 's/,$//')
job(){ v=$1; cam=$2; fr=$3; need=$4
  case $v in v2g) bl=$W/m1v2/scene/cine_m1_anim.blend; sd=$W/m1v2/scripts;; src) bl=$PWD/pipe/scene/cine_m1_anim.blend; sd=$PWD/pipe/scripts;; *) bl=$PWD/pipe/scene/cine_m1_anim_$v.blend; sd=$PWD/pipe/scripts;; esac
  n=$(ls $O/$v 2>/dev/null | grep -c "^${cam}_"); [ "$n" -ge $need ] && return
  echo "$(TZ=America/New_York date '+%F %T') START render v4 $v $cam (have $n/$need)" >> STATUS.log
  for try in 1 2 3; do $B -b --python scripts/render_seq.py -- $bl $sd $O/$v $cam $fr >> $O/render_${v}_$cam.log 2>&1 && break; done
  echo "$(TZ=America/New_York date '+%F %T') END render v4 $v $cam $(ls $O/$v | grep -c "^${cam}_")/$need" >> STATUS.log; }
mkdir -p $O
for cam in r24 portrait45; do job ease $cam all 136 & job v2g $cam all 136 & job src $cam $F15 16 & wait; done
echo RENDERDONE_V4 >> STATUS.log
