#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2
rm -rf /tmp/m1v2_vid; timeout 3000 blender-4.5 -b --python scripts/render_video.py -- export/blend/cine_m1_v2wip.blend /tmp/m1v2_vid > probe/video_v2e.log 2>&1
mkdir -p export/video
for v in right34 front; do ffmpeg -y -loglevel error -framerate 30 -i /tmp/m1v2_vid/${v}_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 export/video/cine_m1_v2wip_${v}.mp4; done
echo VIDDONE >> probe/video_v2e.log
