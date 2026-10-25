#!/bin/bash
# v2.1 收尾：日间 bg（去掉立柱小木板）、夜间 bg/girl/chime（夜间光照）重渲
cd "$(dirname "$0")"
B=${BLENDER:-/workspace/tmp-lkcam/blender-5.2.2-linux-x64/blender}; BL=/workspace/wechat-game/art/regions/lakeside/blend/lakeside_r5h3.blend; R=../render/ending_scene
J(){ python3 -c "import json,sys;p=json.load(open('ending_scene_params.json'));p.update(json.loads(sys.argv[1]));print(json.dumps(p))" "$1"; }
$B -b $BL -P render_ending_scene.py -- $R/day/bg 780 1688 0 still "$(J '{"pass":"bg"}')" >/dev/null 2>&1; echo "bg day $(date +%T)"
$B -b $BL -P render_ending_scene.py -- $R/night/bg 780 1688 1 still "$(J '{"pass":"bg"}')" >/dev/null 2>&1; echo "bg night $(date +%T)"
$B -b $BL -P render_ending_scene.py -- $R/night/girl 780 1688 1 still "$(J '{"pass":"girl"}')" >/dev/null 2>&1; echo "girl night $(date +%T)"
$B -b $BL -P render_ending_scene.py -- $R/night/chime 780 1688 1 "0" "$(J '{"pass":"chime"}')" >/dev/null 2>&1; echo "chime night $(date +%T)"
