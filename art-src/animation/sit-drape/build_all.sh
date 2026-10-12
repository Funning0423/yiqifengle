#!/bin/bash
# Seated drape (cloud-tasks/03-sit-drape.md): rebuild the runtime GLB + anim_meta from the GLB WITHOUT the drape.
#   bash art-src/animation/sit-drape/build_all.sh [work_dir=/tmp/sit-drape]
# Needs: Blender 4.5 LTS on PATH (headless, blender -b -P), python3 with numpy + scipy.  ~25 min (the follow fits run in parallel).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
W=${1:-/tmp/sit-drape}
CHR=creator-build-project/assets/bundles/region_island/character
GLB_NAME=chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb
BASE=022fcad   # int/v1 before the seated drape
mkdir -p "$W/follow"
cd "$REPO"
git show "$BASE:$CHR/$GLB_NAME" > "$W/orig.glb"
git show "$BASE:$CHR/anim_meta.json" > "$W/orig_meta.json"
export SD_GLB="$W/orig.glb"
cd "$HERE/scripts"

# 1. cloth target (Blender cloth, real room chair), 2. skirt-bone fit at the settled frame (sit_hold t=0)
SD_BEND=0.3 SD_FRIC=0.5 blender -b -P sim_dress.py -- "$W/sim.npz" 40
python3 fit_bones.py "$W/sim.npz" "$W/fit_set.npz"
# 3. shape keys (dress + apron) on top of the fitted bones, then the exact-triangle pass in Blender
SD_SMOOTH=80 python3 compose.py "$W/sim.npz" "$W/fit_set.npz" "$W/comp0.npz"
cp "$W/orig_meta.json" "$W/pre_meta.json"
python3 build_glb.py "$W/orig.glb" "$W/pre.glb" "$W/comp0.npz" --meta "$W/pre_meta.json"
blender -b -P resolve.py -- "$W/pre.glb" "$W/comp0.npz" "$W/res.npz"
python3 finalize.py "$W/comp0.npz" "$W/res.npz" "$W/comp.npz"
# 4. skirt bones carry the fixed shape key through the other clip times
export SD_KCOL=8
F="python3 fit_follow.py $W/comp.npz $W/follow"
$F sit_hold:0.25 sit_hold:0.5 sit_hold:0.75 --warm > "$W/follow/a.log" 2>&1 &
$F sit_hold:1.0 sit_hold:1.25 --warm > "$W/follow/b.log" 2>&1 &
$F sit_hold:1.5 sit_hold:1.75 --warm > "$W/follow/c.log" 2>&1 &
$F sit_down:0.4:sit_down_0.400 sit_down:0.6:sit_down_0.600 --sim "$W/sim.npz" > "$W/follow/d.log" 2>&1 &
$F sit_down:1.2 sit_down:1.1 sit_down:1.0 sit_down:0.8667 --warm > "$W/follow/e.log" 2>&1 &
$F sit_down:0.7 sit_down:0.8 --warm > "$W/follow/e2.log" 2>&1 &
$F stand_up:0.1333 stand_up:0.3 stand_up:0.45 --warm > "$W/follow/f.log" 2>&1 &
$F stand_up:0.6 stand_up:0.75 > "$W/follow/g.log" 2>&1 &
wait
grep -h FOLLOW "$W"/follow/*.log
# 5. runtime GLB + anim_meta, Blender penetration check
cp "$W/orig_meta.json" "$REPO/$CHR/anim_meta.json"
python3 build_glb.py "$W/orig.glb" "$REPO/$CHR/$GLB_NAME" "$W/comp.npz" --follow "$W"/follow/*.npz --meta "$REPO/$CHR/anim_meta.json"
blender -b -P verify.py -- "$REPO/$CHR/$GLB_NAME" "$REPO/$CHR/anim_meta.json" "$W/verify.json" | grep VERIFY
cd "$REPO" && node tools/test_manifests.cjs --write > /dev/null
