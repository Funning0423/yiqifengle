# run_pick.sh TAG tx tz h drop lean [extraVARS]
cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/stand
TAG=$1;TX=$2;TZ=$3;H=$4;DROP=$5;LEAN=$6;EX=${7:-}
VARS="[{\"name\":\"lantern_pick_up_stand\",\"mode\":\"pick\",\"frames\":62,\"attach_f\":31,\"tx\":$TX,\"ty\":$H,\"tz\":$TZ,\"drop\":$DROP,\"lean\":$LEAN,\"hold\":[[0,0],[0.8667,0],[1.0333,1],[2.0667,1]]$EX}]" python3 src/author_stand.py /tmp/$TAG.glb /tmp/${TAG}_info.json | tail -1
TY=$(python3 -c "print(0.1502+$H)")
JOBS="[{\"clip\":\"lantern_pick_up_stand\",\"mode\":\"pick\",\"attach_f\":31,\"T\":[$TX,$TY,$TZ],\"hold\":[[0,0],[0.8667,0],[1.0333,1],[2.0667,1]]}]" PLAT="{\"cx\":$TX,\"cz\":$TZ,\"h\":$H,\"sx\":${PSX:-0.22},\"sz\":${PSZ:-0.22}}" INFO=/tmp/${TAG}_info.json \
XF='[{"a":"idle_breathing_loop","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyL","b":"lantern_pick_up_stand"},{"a":"walk_stop_bodyR","b":"lantern_pick_up_stand"},{"a":"lantern_pick_up_stand","b":"idle_breathing_loop_lantern","lan_b":true}]' \
/workspace/tools/blender-4.5.3-linux-x64/blender -b --python src/qa_stand.py -- /tmp/$TAG.glb ../../split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json /tmp/${TAG}_qa.json > /tmp/$TAG.log 2>&1
grep -E "GROUND|Error|error" /tmp/$TAG.log | head -5
python3 src/summ.py /tmp/${TAG}_qa.json
