#!/bin/bash
# resumable variant: smooth weights (sigma, overrides) -> rewrite sk keys -> measure + cloth_pop (+ full check if FULL=1)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender; P=$PWD/pipe
tag=$1; sig=$2; ovr=$3
[ -f probe/variant_$tag.ok ] && exit 0
echo "$(date '+%F %T') START variant $tag sigma=$sig ovr=$ovr" >> STATUS.log
python3 scripts/smooth_weights.py $P/src/R5G2_PASS2C_SRC_grokbot2.json probe/sidecar_$tag.json $sig "$ovr" > /dev/null
[ -f $P/scene/cine_m1_anim_$tag.blend ] || $B -b --python scripts/apply_weights.py -- $P/scene/cine_m1_anim.blend probe/sidecar_$tag.json $P/scene/cine_m1_anim_$tag.blend > probe/aw_$tag.log 2>&1
$B -b --python scripts/measure.py -- $P/scene/cine_m1_anim_$tag.blend $P/scripts probe/measure_$tag.json cine_open_stand:0-90 > probe/measure_$tag.log 2>&1 &
$B -b --python scripts/cloth_pop.py -- $P/scene/cine_m1_anim_$tag.blend $P/scripts probe/cloth_$tag.json > probe/cloth_$tag.log 2>&1 &
wait
if [ "$FULL" = 1 ]; then $B -b --python $P/scripts/check_run.py -- $P/scene/cine_m1_anim_$tag.blend probe/check_$tag.json 1 > probe/check_$tag.log 2>&1 && python3 $P/scripts/summarize.py probe/check_$tag.json > probe/check_${tag}_summary.txt; fi
touch probe/variant_$tag.ok; echo "$(date '+%F %T') END variant $tag" >> STATUS.log
