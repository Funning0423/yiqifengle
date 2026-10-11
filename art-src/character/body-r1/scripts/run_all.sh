#!/bin/bash
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# body-r1: needs head-r2 built first (head_r2_work.blend). Box only, worktree read-only.
set -e; cd "$(dirname "$0")/.."
mkdir -p previews; H2=../head-r2
"$BLENDER" -b --python scripts/build_body.py -- $H2/head_r2_work_final.blend . 2>&1 | grep -E -A3 'DELETE|PARTS|PRIM|DONE|Error|Traceback'
python3 scripts/splice_glb.py "$E60" data/head_prims.npz $H2/tex chr_b_r5g2_body-r1_TEST.glb
python3 scripts/splice_glb.py "$W2" data/head_prims.npz $H2/tex chr_b_r5g2_body-r1_walk-v2_TEST.glb
# preview-only blink variants (eye patch UV offset baked) -> previews/blink_*.glb (not deliverables)
for st in half:0,0.5 closed:0.5,0; do n=${st%%:*}; o=${st#*:}
  BLINK=$o NPZ=blink_$n.npz "$BLENDER" -b --python scripts/build_body.py -- $H2/head_r2_work_final.blend . >/dev/null 2>&1
  python3 scripts/splice_glb.py "$E60" data/blink_$n.npz $H2/tex previews/blink_$n.glb >/dev/null; done
