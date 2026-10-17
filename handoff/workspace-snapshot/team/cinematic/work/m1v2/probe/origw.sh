#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2
timeout 600 blender-4.5 -b --python scripts/make_origw.py > probe/origw_build.log 2>&1
timeout 1800 blender-4.5 -b --python scripts/check_run.py -- scene/cine_m1_anim_origw.blend probe/check_v2g_origw.json 1 > probe/check_v2g_origw.log 2>&1
python3 scripts/summarize.py probe/check_v2g_origw.json > probe/check_v2g_origw_summary.txt
echo ORIGWDONE >> probe/origw_build.log
