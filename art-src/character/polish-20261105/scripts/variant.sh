#!/bin/bash
# variant.sh <name> '<POLISH_P json>' [k]  -> builds /tmp/var_<name>.glb and prints raw + morph cloth QA
B=/home/box/apps/blender-5.2.2-linux-x64/blender; D=/workspace/qifengle/char-polish
cd $D/tools && POLISH_P="$2" python3 build_polish.py $D/before/heroine_live.glb /tmp/var_$1.glb ${3:-0.3} | grep -v "^mustard\|^saved"
for m in "" $D/anim_meta_e976a733.json; do GAME_MORPH=$m $B -b --python game_morph.py -P qa_cloth.py -- /tmp/var_$1.glb /tmp/q_$1_${m:+m}.json >/dev/null 2>&1 & done; wait
python3 - $1 <<'PY'
import json,sys;n=sys.argv[1]
for t in ('','m'):
    d=json.load(open(f'/tmp/q_{n}_{t}.json')); print(n,'MORPH' if t else 'RAW  ',' '.join(f"{c}:{d[c]['apron_dress']}/{d[c]['dress_legs']}" for c in ('sit_hold','sit_down','stand_up','walk_loop')))
PY
