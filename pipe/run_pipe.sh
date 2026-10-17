#!/bin/bash
# resumable staged pipeline (stage markers in probe/stage_*.ok). Blender 5.2.2 (4.5 not installed on the box anymore)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe; B=/home/box/apps/blender-5.2.2-linux-x64/blender
L=../STATUS.log
st(){ [ -f probe/stage_$1.ok ] && return 0; echo "$(date '+%F %T') START pipe $1" >> $L; shift_cmd="$2"; bash -c "$2" > probe/$1.log 2>&1; rc=$?; echo "$(date '+%F %T') END pipe $1 rc=$rc" >> $L; [ $rc -eq 0 ] && touch probe/stage_$1.ok || exit $rc; }
st build "$B -b --python scripts/build_scene.py"
st anim "$B -b --python scripts/anim_build.py"
st anchors "$B -b --python scripts/anchors_report.py"
st measure "$B -b --python ../scripts/measure.py -- scene/cine_m1_anim.blend scripts ../probe/measure_src.json"
st check "$B -b --python scripts/check_run.py -- scene/cine_m1_anim.blend probe/check_src.json 1 && python3 scripts/summarize.py probe/check_src.json > probe/check_src_summary.txt"
echo PIPEDONE >> $L
