#!/bin/bash
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# body-r1: needs head-r2 built first (head_r2_work.blend). Box only, worktree read-only.
set -e; cd "$(dirname "$0")/.."
H2=../head-r2; TX=tex
"$BLENDER" -b --python scripts/build_body.py -- $H2/head_r2_work_final.blend . 2>&1 | grep -E -A3 'DELETE|PARTS|PRIM|DONE|Error|Traceback'
python3 scripts/splice_glb.py "$E60" data/head_prims.npz $TX chr_b_r5g2_body-r3_TEST.glb
python3 scripts/splice_glb.py "$W2" data/head_prims.npz $TX chr_b_r5g2_body-r3_walk-v2_TEST.glb
HR=$(python3 -c "import json;L=json.load(open('data/params.json'))['legs'];print(L['hem_raise'],L['hem_z0'],L['hem_z1'])")
for g in chr_b_r5g2_body-r3_TEST.glb chr_b_r5g2_body-r3_walk-v2_TEST.glb; do python3 scripts/raise_hem.py $g $g $HR; done
for g in chr_b_r5g2_body-r3_TEST.glb chr_b_r5g2_body-r3_walk-v2_TEST.glb; do python3 scripts/remap_mid.py $g $g; done
