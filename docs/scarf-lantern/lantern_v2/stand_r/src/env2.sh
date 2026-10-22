cd /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/stand
export SOCK_ROT="$(cat ../qa_hinge/SOCK_ROT.json)" NPZ=/workspace/yiqifengle/previews/角色动画bot/scarf-lantern/lantern_v2/qa_v3b/lantern_hold_R_v3b_delta.npz
TX=-0.31;TZ=0.33;H=0.40;TY=0.5502
PH='[[0,0],[0.8667,0],[1.0333,1],[2.0667,1]]';UH='[[0,1],[1.1333,1],[1.3333,0],[2.3333,0]]';PS='[[0,1],[1.0333,1],[1.3333,0],[2.0667,0]]';US='[[0,0],[0.8667,0],[1.1,1],[2.3333,1]]'
export JOBS="[{\"clip\":\"lantern_pick_up_stand\",\"mode\":\"pick\",\"attach_f\":31,\"T\":[$TX,$TY,$TZ],\"hold\":$PH,\"settle\":$PS},{\"clip\":\"lantern_put_down_stand\",\"mode\":\"put\",\"attach_f\":34,\"T\":[$TX,$TY,$TZ],\"hold\":$UH,\"settle\":$US}]" PLAT="{\"cx\":$TX,\"cz\":$TZ,\"h\":$H,\"sx\":0.22,\"sz\":0.22}" INFO=../stand_r/work/r3_info.json
MT=../../split/planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json;B=/workspace/tools/blender-4.5.3-linux-x64/blender
