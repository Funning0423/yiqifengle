#!/bin/bash
# 重渲结局画面全部分层（约 15–20 分钟）
cd "$(dirname "$0")"
B=${BLENDER:-/workspace/tmp-lkcam/blender-5.2.2-linux-x64/blender}; BL=/workspace/wechat-game/art/regions/lakeside/blend/lakeside_r5h3.blend; R=../render/ending_scene
J(){ python3 -c "import json,sys;p=json.load(open('ending_scene_params.json'));p.update(json.loads(sys.argv[1]));print(json.dumps(p))" "$1"; }
PS=$(python3 -c "print(','.join(str(i/16) for i in range(16)))")
for N in 0 1; do T=$([ $N = 1 ] && echo night || echo day)
  $B -b $BL -P render_ending_scene.py -- $R/$T/bg 780 1688 $N still "$(J '{"pass":"bg"}')" >/dev/null 2>&1; echo "bg $T $(date +%T)"
  $B -b $BL -P render_ending_scene.py -- $R/$T/girl 780 1688 $N still "$(J '{"pass":"girl"}')" >/dev/null 2>&1; echo "girl $T $(date +%T)"
  $B -b $BL -P render_ending_scene.py -- $R/$T/chime 780 1688 $N "$PS" "$(J '{"pass":"chime"}')" >/dev/null 2>&1; echo "chime $T $(date +%T)"
done
