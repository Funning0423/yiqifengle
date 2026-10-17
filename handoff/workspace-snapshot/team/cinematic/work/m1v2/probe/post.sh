#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2
timeout 900 blender-4.5 -b --python scripts/export_glb.py -- export/clips/cine_m1_open_stand_turn.glb > probe/export_v2e.log 2>&1
python3 scripts/glb_probe.py export/clips/cine_m1_open_stand_turn.glb > probe/glb_probe_v2e.json 2>&1
mkdir -p export/timing && python3 scripts/make_timing.py export/timing probe/check_v2e.json export/clips/cine_m1_open_stand_turn.glb.root_poses.json > probe/timing_v2e.log 2>&1
echo POSTDONE >> probe/export_v2e.log
