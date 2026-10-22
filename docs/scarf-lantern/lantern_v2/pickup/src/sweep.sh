# sweep.sh TAG 'json-variant-fields'
cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/pickup
VARS="[{\"name\":\"lantern_pick_up\",\"tx\":-0.24,\"tz\":0.16,\"lean\":34,\"drop\":0.66,\"w0\":0.7,\"hold\":[[0,0],[0.7333,0],[0.9,1],[2,1]],\"hold_rev\":[[0,1],[1.1,1],[1.2667,0],[2,0]],$2}]" python3 src/author.py /tmp/$1.glb /tmp/$1_info.json >/dev/null
cd src;JOBS="$(cat ../s1_jobs.json)" INFO=/tmp/$1_info.json XF='[{"a":"idle_breathing_loop","b":"lantern_pick_up"},{"a":"lantern_pick_up","b":"idle_breathing_loop_lantern","lan_b":true}]' /workspace/tools/blender-4.5.3-linux-x64/blender -b --python qa_pick.py -- /tmp/$1.glb ../../../split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json /tmp/$1_qa.json >/tmp/$1.log 2>&1; python3 summ.py /tmp/$1_qa.json
