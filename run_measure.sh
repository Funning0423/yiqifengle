#!/bin/bash
# resumable: measure.py keeps <out>.partial and skips done frames
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; B=/home/box/apps/blender-5.2.2-linux-x64/blender
W=/workspace/wechat-game/team/cinematic/work
tag=$1; blend=$2; sdir=$3
[ -f probe/measure_$tag.json ] && { echo "SKIP $tag"; exit 0; }
echo "$(date '+%F %T') START measure $tag" >> STATUS.log
$B -b --python scripts/measure.py -- $blend $sdir probe/measure_$tag.json > probe/measure_$tag.log 2>&1
echo "$(date '+%F %T') END measure $tag rc=$?" >> STATUS.log
