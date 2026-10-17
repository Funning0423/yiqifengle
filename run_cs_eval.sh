#!/bin/bash
# v3 resumable: knots -> blend -> measure, cloth_pop, jitter_vis, full check, joints
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; P=$PWD/pipe; tag=$1
L(){ echo "$(TZ=America/New_York date '+%F %T') $*" >> STATUS.log; }
[ -f probe/eval_$tag.ok ] && exit 0
X=$P/scene/cine_m1_anim_$tag.blend
[ -f $X ] || { $B -b --python cs/write_knots.py -- $P/scene/cine_m1_anim.blend cs/knots_$tag.npz $X > probe/wk_$tag.log 2>&1; L "wrote $X"; }
L "START eval $tag"
[ -f probe/measure_$tag.json ] || $B -b --python scripts/measure.py -- $X $P/scripts probe/measure_$tag.json > probe/measure_$tag.log 2>&1 &
[ -f probe/cloth_$tag.json ] || $B -b --python scripts/cloth_pop.py -- $X $P/scripts probe/cloth_$tag.json > probe/cloth_$tag.log 2>&1 &
[ -f probe/jitter_$tag.json ] || $B -b --python scripts/jitter_vis.py -- $X $P/scripts probe/jitter_$tag.json 3 > probe/jitter_$tag.log 2>&1 &
[ -f probe/joints_$tag.json ] || $B -b --python scripts/joint_vel.py -- $X $P/scripts probe/joints_$tag.json > probe/joints_$tag.log 2>&1 &
[ -f probe/check_${tag}_summary.txt ] || { $B -b --python $P/scripts/check_run.py -- $X probe/check_$tag.json 1 > probe/check_$tag.log 2>&1 && python3 $P/scripts/summarize.py probe/check_$tag.json > probe/check_${tag}_summary.txt; } &
wait; touch probe/eval_$tag.ok; L "END eval $tag"
