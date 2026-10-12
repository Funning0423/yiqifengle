#!/bin/bash
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# rebuild head-r2 (box only). Inputs: e60 runtime GLB (worktree, read-only) + walk-v2 TEST GLB.
set -e; cd "$(dirname "$0")/.."
python3 scripts/paint_textures.py tex
"$BLENDER" -b --python scripts/build_head.py -- "$E60" . 2>&1 | grep -E -A3 'HAT|PARTS|PRIM|DONE|Error|Traceback'
python3 scripts/splice_glb.py "$E60" data/head_prims.npz tex chr_b_r5g2_head-r2_TEST.glb
python3 scripts/splice_glb.py "$W2" data/head_prims.npz tex chr_b_r5g2_head-r2_walk-v2_TEST.glb
