# 走路类 clip 腿×裙核实：55368056 基线 GLB（=31ebfa53）vs 当前（3132274b scarfbones），原 clip（BASELINE=1），30 fps，无风
cd /workspace/yiqifengle/previews/角色动画bot/walk_verify
B=/workspace/tools/blender-4.5.3-linux-x64/blender
export BASELINE=1 SOCK_ROT="$(cat ../scarf-lantern/lantern_v2/qa_hinge/SOCK_ROT.json)" NPZ=/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/qa_v3b/lantern_hold_R_v3b_delta.npz
CL=walk_loop,walk_start,walk_stop_bodyL,walk_stop_bodyR,walk_turn_90_bodyL,walk_turn_90_bodyR,walk_turn_180,walk_turn_180_bodyR,idle_breathing_loop,walk_start_stepdown
CLIPS=$CL $B -b --python src/qa_walk.py -- work/base_55368056.glb work/base_anim_meta.json out/base.json > out/base.log 2>&1 &
CLIPS=$CL $B -b --python src/qa_walk.py -- ../scarf-lantern/split/planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb ../scarf-lantern/split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json out/current.json > out/current.log 2>&1 &
wait
