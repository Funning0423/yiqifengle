# v3b 9 段提灯 + 14 过渡 + 最大风 + ±8° 压力测试
cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/qa_v3b
B=/workspace/tools/blender-4.5.3-linux-x64/blender;G=../work_dense.glb;MT=../../split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json
export SOCK_ROT="$(cat ../qa_hinge/SOCK_ROT.json)" NPZ=$PWD/lantern_hold_R_v3b_delta.npz SOCK='[0.0138,0.0803,0.0073]'
XFS=idle_breathing_loop\>walk_start,walk_loop\>walk_stop_bodyL,walk_loop\>walk_stop_bodyR,walk_loop\>walk_turn_180,walk_loop\>walk_turn_180_bodyR,walk_loop\>walk_turn_90_bodyL,walk_loop\>walk_turn_90_bodyR,walk_start\>walk_loop,walk_stop_bodyL\>idle_breathing_loop,walk_stop_bodyR\>idle_breathing_loop,walk_turn_180\>walk_loop,walk_turn_180_bodyR\>walk_loop,walk_turn_90_bodyL\>walk_loop,walk_turn_90_bodyR\>walk_loop
CLIPS=idle_breathing_loop,walk_loop,walk_start WIND=1 $B -b --python src/qa_v3b.py -- $G $MT out/qa_a.json > out/qa_a.log 2>&1 &
CLIPS=walk_stop_bodyL,walk_stop_bodyR,walk_turn_90_bodyL WIND=1 $B -b --python src/qa_v3b.py -- $G $MT out/qa_b.json > out/qa_b.log 2>&1 &
CLIPS=walk_turn_180,walk_turn_180_bodyR,walk_turn_90_bodyR WIND=1 $B -b --python src/qa_v3b.py -- $G $MT out/qa_c.json > out/qa_c.log 2>&1 &
CLIPS=walk_loop XF=$XFS WIND=1 $B -b --python src/qa_v3b.py -- $G $MT out/qa_xf.json > out/qa_xf.log 2>&1 &
PFORCE=1 CLIPS=idle_breathing_loop,walk_loop,walk_start,walk_stop_bodyL,walk_stop_bodyR,walk_turn_90_bodyL,walk_turn_90_bodyR,walk_turn_180,walk_turn_180_bodyR WIND=1 $B -b --python src/qa_v3b.py -- $G $MT out/stress.json > out/stress.log 2>&1 &
wait
