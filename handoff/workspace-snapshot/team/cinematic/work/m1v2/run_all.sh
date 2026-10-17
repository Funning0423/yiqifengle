#!/bin/bash
# M1 v2 pipeline. Drop-in a new model:  CHAR_BLEND=/path/new.blend SIT_POSES_PY=/path/p2_poses.py ./run_all.sh <tag>
# Global character scale: CHAR_SCALE_MODE=bakeK|removeK  CHAR_SCALE=<extra factor>
set -e; cd "$(dirname "$0")"; TAG=${1:-v2}; B=blender-4.5
$B -b --python scripts/build_scene.py > probe/build_$TAG.log 2>&1
ARMFIX=${ARMFIX:-0} $B -b --python scripts/anim_build.py > probe/anim_$TAG.log 2>&1
$B -b --python scripts/anchors_report.py > probe/anchors_$TAG.log 2>&1
$B -b --python scripts/check_run.py -- scene/cine_m1_anim.blend probe/check_$TAG.json 1 > probe/check_$TAG.log 2>&1
python3 scripts/summarize.py probe/check_$TAG.json > probe/check_${TAG}_summary.txt
echo DONE $TAG
