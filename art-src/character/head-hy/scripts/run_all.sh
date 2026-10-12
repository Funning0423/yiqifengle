#!/bin/bash
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# head-hy: Hunyuan V3.1 head -> game-poly head on top of head-r2/head_r2_work_final.blend (body unchanged, neck/collar kept).
# Needs HUNYUAN_GLB (branch assets/hunyuan-head: art-src/character/hunyuan/hunyuan_head_v31.glb, 79 MB, not on this branch):
#   git cat-file -p origin/assets/hunyuan-head:art-src/character/hunyuan/hunyuan_head_v31.glb > /tmp/hy/hunyuan_head_v31.glb
set -e; cd "$(dirname "$0")/.."
mkdir -p "$(dirname "${HY_CLASS:-/tmp/hy/face_class.npy}")"
sed "s#../data/face_class.npy#${HY_CLASS:-/tmp/hy/face_class.npy}#; s#../data/face_class_stats.json#/dev/null#" ../hunyuan-eval/scripts/classify_faces.py > /tmp/hy_classify.py
python3 /tmp/hy_classify.py >/dev/null
python3 scripts/paint_textures.py .
"$BLENDER" -b --python scripts/build_head_hy.py -- ../head-r2/head_r2_work_final.blend . 2>&1 | grep -E 'SRC|ENV|HAT|HEAD_TRIS|DONE|Error|Traceback'
cp head_hy_work.blend head_hy_work_final.blend
