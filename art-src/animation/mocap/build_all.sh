#!/bin/bash
# Full rebuild of the mocap clips into the character GLB (needs CMU ASF/AMC in $CMU_DIR, Blender 4.5, ffmpeg, python3 numpy+PIL).
#   art-src/animation/mocap/build_all.sh [skip-previews]
# Previews compare against the hand-keyed clips on $OLD_REF (default origin/int/v1).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
OUT=${MOCAP_OUT:-/tmp/mc/out}
export MOCAP_CACHE=${MOCAP_CACHE:-/tmp/mc/cache}
CHR=$REPO/creator-build-project/assets/bundles/region_island/character
GLB=$CHR/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb
OLD_REF=${OLD_REF:-origin/int/v1}
rm -rf "$MOCAP_CACHE" && mkdir -p "$OUT"
cd "$HERE/scripts"
python3 export_clips.py "$OUT"                                   # 1. build clips (numpy)
blender -b -P solve_skirts.py -- "$OUT" 2>&1 | grep -E "SKIRT|Error|Traceback"   # 2. skirt / arm clearance (Blender bvhtree)
python3 write_glb.py "$OUT"                                       # 3. GLB + .meta + anim_meta.json
(cd "$REPO" && node tools/test_manifests.cjs --write)
python3 ../qa/run_qa.py "$GLB" "$CHR/anim_meta.json" /tmp/mc/qa_new "$HERE/qa/summary.json"
if [ "${1:-}" != "skip-previews" ]; then
  git -C "$REPO" show "$OLD_REF:creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb" > /tmp/mc/old.glb
  git -C "$REPO" show "$OLD_REF:creator-build-project/assets/bundles/region_island/character/anim_meta.json" > /tmp/mc/old_anim_meta.json
  python3 previews.py "$GLB" "$CHR/anim_meta.json" /tmp/mc/old.glb /tmp/mc/old_anim_meta.json "$HERE/previews"
fi
