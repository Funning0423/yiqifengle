#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2-pass2c; T=p2c2; B=blender-4.5
cp scene/cine_m1_anim.blend export/blend/cine_m1_pass2c_wip.blend
$B -b --python scripts/make_origw.py > probe/origw_$T.log 2>&1
$B -b --python scripts/check_run.py -- scene/cine_m1_anim_origw.blend probe/check_${T}_origw.json 1 > probe/check_${T}_origw.log 2>&1
python3 scripts/summarize.py probe/check_${T}_origw.json > probe/check_${T}_origw_summary.txt
$B -b --python scripts/bonediff.py -- export/blend/cine_m1_pass2c_wip.blend ../m1v2/export/blend/cine_m1_v2wip.blend probe/bonediff_${T}_vs_v2g.json > probe/bonediff_$T.log 2>&1
$B -b --python scripts/rest_check.py -- export/blend/cine_m1_pass2c_wip.blend probe/rest_check_4w.json > probe/rest_4w.log 2>&1
$B -b --python scripts/rest_check.py -- scene/cine_m1_anim_origw.blend probe/rest_check_origw.json > probe/rest_origw.log 2>&1
rm -rf probe/f30_32_new; $B -b --python scripts/export_f30_32.py -- export/blend/cine_m1_pass2c_wip.blend probe/f30_32_new new > probe/exp_new.log 2>&1
cp export/blend/cine_m1_pass2c_wip.blend /tmp/nobump.blend
BUMP_MM=0 FOOT_LIFT=0 echo skip
timeout 900 $B -b --python scripts/export_glb.py -- export/clips/cine_m1_open_stand_turn.glb > probe/export_$T.log 2>&1
python3 scripts/glb_probe.py export/clips/cine_m1_open_stand_turn.glb > export/report/glb_probe_$T.json 2>&1
python3 scripts/make_timing.py export/timing probe/check_$T.json export/clips/cine_m1_open_stand_turn.glb.root_poses.json > probe/timing_$T.log 2>&1
python3 scripts/contact_report.py probe/check_$T.json export/report/contact_report_$T.json > probe/contact_$T.log 2>&1
echo PKGDONE
