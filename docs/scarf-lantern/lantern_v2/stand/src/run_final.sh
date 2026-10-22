# 终版：pick + put 同一 GLB；高台 h=0.40，灯底中心 (-0.20, 0.40, 0.36)（她的根空间 glTF）
cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/stand
export SOCK_ROT="$(cat ../qa_hinge/SOCK_ROT.json)"
TAG=${1:-final};TX=-0.20;TZ=0.36;H=0.40;TY=0.5502
COMMON="\"tx\":$TX,\"ty\":$H,\"tz\":$TZ,\"drop\":0.36,\"lean\":24,\"pole\":[-0.1,-0.4,-1.0]"
PH='[[0,0],[0.8667,0],[1.0333,1],[2.0667,1]]';UH='[[0,1],[1.1333,1],[1.3333,0],[2.3333,0]]';PS='[[0,1],[1.0333,1],[1.3333,0],[2.0667,0]]';US='[[0,0],[0.8667,0],[1.1,1],[2.3333,1]]'
VARS="[{\"name\":\"lantern_pick_up_stand\",\"mode\":\"pick\",\"frames\":62,\"attach_f\":31,$COMMON,\"hold\":$PH},{\"name\":\"lantern_put_down_stand\",\"mode\":\"put\",\"frames\":70,\"attach_f\":34,$COMMON,\"hold\":$UH}]" [ -n "$SKIPAUTH" ] || python3 src/author_stand.py work/$TAG.glb work/${TAG}_info.json | grep -v SITW
JOBS="[{\"clip\":\"lantern_pick_up_stand\",\"mode\":\"pick\",\"attach_f\":31,\"T\":[$TX,$TY,$TZ],\"hold\":$PH,\"settle\":$PS},{\"clip\":\"lantern_put_down_stand\",\"mode\":\"put\",\"attach_f\":34,\"T\":[$TX,$TY,$TZ],\"hold\":$UH,\"settle\":$US}]" PLAT="{\"cx\":$TX,\"cz\":$TZ,\"h\":$H,\"sx\":0.22,\"sz\":0.22}" INFO=work/${TAG}_info.json \
XF='[{"a":"idle_breathing_loop","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyL","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyR","b":"lantern_pick_up_stand"},{"a":"lantern_pick_up_stand","b":"idle_breathing_loop_lantern","lan_b":true},{"a":"idle_breathing_loop_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"walk_stop_bodyL_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"walk_stop_bodyR_lantern","b":"lantern_put_down_stand","lan_a":true},{"a":"lantern_put_down_stand","b":"idle_breathing_loop"},{"a":"lantern_put_down_stand","b":"walk_start"}]' \
/workspace/tools/blender-4.5.3-linux-x64/blender -b --python src/qa_stand.py -- work/$TAG.glb ../../split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json work/${TAG}_qa.json > work/$TAG.log 2>&1
grep -E "GROUND|Error" work/$TAG.log; python3 src/summ.py work/${TAG}_qa.json; python3 src/motion_check.py work/${TAG}_qa.json
