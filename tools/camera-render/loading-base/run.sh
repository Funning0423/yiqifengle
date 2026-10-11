#!/usr/bin/env bash
# Re-render the loading-page base from the runtime room home camera (preview only; nothing is committed).
# 仓库副本：tools/camera-render/loading-base/run.sh。原先放在 previews/运镜bot/loading-base/src/，那时 OUT=上一级目录；现在 OUT 默认就是那个目录。
# 依赖：blender 4.5 在 PATH 上（或 BLENDER=...），python3 + numpy + Pillow + opencv-python，cwebp。
# Usage: src/run.sh [CHAR_GLB]   e.g. after 角色动画bot re-does the sit pose: src/run.sh /path/to/new_char.glb
#   env: OUT (输出目录，默认 /workspace/yiqifengle/previews/运镜bot/loading-base；图片不要放进仓库), TREE (int/v1 worktree, default work/int-v1), CLIP (default sit_hold), CLIP_T (s into clip, default 0),
#        SHIFT (lens shift_y, default -0.14), FSTOP (default 1.8), SAMPLES (default 32)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); OUT=${OUT:-/workspace/yiqifengle/previews/运镜bot/loading-base}; TREE=${TREE:-/workspace/yiqifengle/work/int-v1}
mkdir -p "$OUT/src"
R=$TREE/creator-build-project/assets/bundles/region_island
CHAR=${1:-$R/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb}
TMP=$(mktemp -d); SHIFT=${SHIFT:--0.14}
# 1) pose straight from the runtime config (RegionCameraData 'sitting-room' -> FirstsliceRoutes.cameraHome, via flow_sim t=0)
(cd "$TREE" && node "$HERE/shots.cjs" "$TMP/home.json" 0 HOME)
python3 - "$TMP/home.json" <<PY
import json,sys,os;p=sys.argv[1];s=json.load(open(p));s[0].update(state='home',clip=os.environ.get('CLIP','sit_hold'),clipTime=float(os.environ.get('CLIP_T','0')));json.dump(s,open(p,'w'),indent=1)
PY
cp "$TMP/home.json" "$OUT/src/home_shot.json"
# 2) beauty render (EEVEE, AgX, DOF) + girl matte, same camera
LB_SAMPLES=${SAMPLES:-32} LB_FSTOP=${FSTOP:-1.8} LB_SHIFT_Y=$SHIFT "${BLENDER:-blender}" -b -P "$HERE/render_base.py" -- "$R/combined_visual_m.glb" "$CHAR" "$TMP/home.json" "$TMP/raw.png" > "$TMP/raw.log" 2>&1 &
LB_PRE="$HERE/mask_girl.py" LB_SAMPLES=4 LB_SHIFT_Y=$SHIFT "${BLENDER:-blender}" -b -P "$HERE/render_base.py" -- "$R/combined_visual_m.glb" "$CHAR" "$TMP/home.json" "$TMP/mask.png" > "$TMP/mask.log" 2>&1 &
wait; grep -h POSE "$TMP/raw.log"
python3 -c "import numpy as np,PIL.Image as I,sys;a=np.array(I.open('$TMP/mask.png').convert('L'))>128;y=np.where(a)[0];print('girl rows %.1f%%-%.1f%% (must stay within 32%%-75%%)'%(y.min()/16.24,y.max()/16.24))"
# 3) post (soft focus, cream grade, title veil, bottom mist) + exports, 4) mocks
python3 "$HERE/post.py" "$TMP/raw.png" "$TMP/mask.png" "$OUT"
python3 "$HERE/mock.py" "$OUT/loading_base_final.jpg" "$OUT" final
python3 "$HERE/mock.py" "$OUT/loading_base_alt_softer_brighter.jpg" "$OUT" alt
cp "$TMP/raw.png" "$OUT/src/last_raw_render.png"; echo "done -> $OUT"
