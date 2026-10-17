#!/bin/bash
set -x
cd /workspace/wechat-game/team/cinematic/work/m1v2; T=v2g
cp scene/cine_m1_anim.blend export/blend/cine_m1_v2wip.blend
timeout 900 blender-4.5 -b --python scripts/export_glb.py -- export/clips/cine_m1_open_stand_turn.glb > probe/export_$T.log 2>&1
python3 scripts/glb_probe.py export/clips/cine_m1_open_stand_turn.glb > export/report/glb_probe_$T.json 2>&1
python3 scripts/make_timing.py export/timing probe/check_$T.json export/clips/cine_m1_open_stand_turn.glb.root_poses.json > probe/timing_$T.log 2>&1
python3 scripts/contact_report.py probe/check_$T.json export/report/contact_report_$T.json
python3 scripts/compare.py ../../outbox/20261009T1656-cinematic-m1-v1/report/clipping_per_frame_v5.json probe/check_$T.json export/report/compare_v1_vs_$T.txt > /dev/null
cp probe/check_$T.json export/report/clipping_per_frame_$T.json; cp probe/check_${T}_summary.txt export/report/clipping_summary_$T.txt
cp probe/anim_build_log.json export/report/anim_build_log_$T.json; cp probe/anchors_latest.json export/report/anchors_$T.json
timeout 600 blender-4.5 -b --python scripts/continuity.py -- export/blend/cine_m1_v2wip.blend export/report/continuity_stand_to_turn.json > probe/cont_$T.log 2>&1
timeout 1800 blender-4.5 -b --python scripts/render_m1.py -- cine_open_stand:0:a,cine_open_stand:25:b,cine_open_stand:35:c,cine_open_stand:45:d,cine_open_stand:60:e,cine_open_stand:90:f,cine_open_turn:12:g,cine_open_turn:22:h,cine_open_turn:33:i,cine_open_turn:45:j,cine_open_safe_end:0:k,cine_home_safe_end:0:l export/renders > probe/renders_$T.log 2>&1
rm -rf /tmp/m1v2_vid; timeout 3600 blender-4.5 -b --python scripts/render_video.py -- export/blend/cine_m1_v2wip.blend /tmp/m1v2_vid > probe/video_$T.log 2>&1
for v in right34 front; do ffmpeg -y -loglevel error -framerate 30 -i /tmp/m1v2_vid/${v}_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 export/video/cine_m1_v2wip_${v}.mp4; done
echo PKGDONE
