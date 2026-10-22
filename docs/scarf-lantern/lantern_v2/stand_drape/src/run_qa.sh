# 用烘好的 GLB 跑高台两段 + 9 过渡全帧 QA（+渲染）
. /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/stand_drape/src/env.sh
G=${1:-../stand_drape/out/stand_drape_qa.glb};O=${2:-../stand_drape/out/qa}
XF='[{"a":"idle_breathing_loop","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyL","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyR","b":"lantern_pick_up_stand"},{"a":"lantern_pick_up_stand","b":"idle_breathing_loop_lantern","lan_b":true},{"a":"idle_breathing_loop_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"walk_stop_bodyL_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"walk_stop_bodyR_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"lantern_put_down_stand","b":"idle_breathing_loop"},{"a":"lantern_put_down_stand","b":"walk_start"}]' \
$B -b --python ../stand_drape/src/qa_stand_drape.py -- $G $MT $O.json > $O.log 2>&1
