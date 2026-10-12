#!/bin/bash
# Sit drape pipeline after the cloth sims (drape_sim.py) and the dress panel chains (opt_bones.py <clip>):
#   run_all.sh <work_dir> <dress sim.npz> <apron sim.npz> <base.glb> <base anim_meta> <out.glb> <out anim_meta>
# work_dir: body.glb + body_<clip>.npz (fix_body.py), opt_x_<clip>.npy (opt_bones.py), drape_DRESS.npz (weights).
set -euo pipefail
W=$1; SIMD=$2; SIMA=$3; BASE=$4; BMETA=$5; OUT=$6; OMETA=$7
H=$(cd "$(dirname "$0")" && pwd)
B="blender -b -P"
q() { grep -v '^$' | grep -v '^Blender' || true; }
python3 "$H/opt_bones.py" "$W/body.glb" "$W" "$SIMD" merge
rm -f "$W"/legfix_*.npz
for c in sit_down stand_up; do python3 "$H/opt_bones.py" "$W/body.glb" "$W" "$SIMD" legfix $c > "$W/legfix_$c.log" 2>&1 & done
wait
python3 "$H/opt_bones.py" "$W/body.glb" "$W" "$SIMD" legfix_apply
REUSE_BONES=1 STOP_AFTER_BONES=1 $B "$H/build_drape.py" -- "$W/body.glb" "$W" "$SIMD" DRESS 2>&1 | q | tail -n 1
$B "$H/key_pocs.py" -- "$W/body.glb" "$W" DRESS 2>&1 | q | tail -n 1
STOP_AFTER_BONES=1 BONE_ITERS=0 $B "$H/build_drape.py" -- "$W/body.glb" "$W" "$SIMA" APRON 2>&1 | q | tail -n 1
$B "$H/key_pocs.py" -- "$W/body.glb" "$W" APRON 2>&1 | q | tail -n 1
STOP_AFTER_BONES=1 BONE_ITERS=0 $B "$H/build_drape.py" -- "$W/body.glb" "$W" "$SIMA" BOW 2>&1 | q | tail -n 1
$B "$H/key_pocs.py" -- "$W/body.glb" "$W" BOW 2>&1 | q | tail -n 1
HANDS_ITERS=18 $B "$H/fix_hands.py" -- "$W/body.glb" "$W" 2>&1 | q | tail -n 1 | cut -c1-600
python3 "$H/build_glb.py" "$BASE" "$W" "$OUT" "$BMETA" "$OMETA" | cut -c1-300
# keys again on the clips as written (key reduction), same clips
python3 "$H/decode_clips.py" "$OUT" "$W"
for m in DRESS APRON BOW; do $B "$H/key_pocs.py" -- "$W/body.glb" "$W" $m 2>&1 | q | tail -n 1; done
# hands last: a key solve after it pushes the lap cloth back up around them
HANDS_ITERS=18 $B "$H/fix_hands.py" -- "$W/body.glb" "$W" 2>&1 | q | tail -n 1 | cut -c1-600
python3 "$H/build_glb.py" "$BASE" "$W" "$OUT" "$BMETA" "$OMETA" | cut -c1-300
