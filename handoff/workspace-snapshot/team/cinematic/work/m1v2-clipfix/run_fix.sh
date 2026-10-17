#!/bin/bash
# resumable: fix variant -> measure, cloth_pop, jitter_vis, full check
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; P=$PWD/pipe
tag=$1; sig=$2; near=$3; far=$4; base=${5:-$P/scene/cine_m1_anim.blend}
[ -f probe/fix_$tag.ok ] && exit 0
echo "$(date '+%F %T') START fix $tag sigma=$sig near=$near far=$far" >> STATUS.log
[ -f $P/scene/cine_m1_anim_$tag.blend ] || $B -b --python scripts/fix_cloth.py -- $base $P/scripts $P/src/R5G2_PASS2C_SRC_grokbot2.json $sig $near $far $P/scene/cine_m1_anim_$tag.blend > probe/fix_$tag.log 2>&1
X=$P/scene/cine_m1_anim_$tag.blend
$B -b --python scripts/measure.py -- $X $P/scripts probe/measure_$tag.json > probe/measure_$tag.log 2>&1 &
$B -b --python scripts/cloth_pop.py -- $X $P/scripts probe/cloth_$tag.json > probe/cloth_$tag.log 2>&1 &
$B -b --python scripts/jitter_vis.py -- $X $P/scripts probe/jitter_$tag.json 3 > probe/jitter_$tag.log 2>&1 &
$B -b --python $P/scripts/check_run.py -- $X probe/check_$tag.json 1 > probe/check_$tag.log 2>&1 && python3 $P/scripts/summarize.py probe/check_$tag.json > probe/check_${tag}_summary.txt &
wait; touch probe/fix_$tag.ok; echo "$(date '+%F %T') END fix $tag" >> STATUS.log
