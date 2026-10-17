#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2
timeout 600 blender-4.5 -b --python scripts/anim_build.py > probe/anim_$1.log 2>&1
timeout 300 blender-4.5 -b scene/cine_m1_anim.blend --python /tmp/legdiag2.py > probe/diag_$1.log 2>&1
echo QDONE >> probe/diag_$1.log
