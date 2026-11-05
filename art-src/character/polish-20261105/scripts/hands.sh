#!/bin/bash
# hands.sh <name> '<json>' : build + qa_clash summary (hand/sleeve vs cloth) per clip
B=/home/box/apps/blender-5.2.2-linux-x64/blender; D=/workspace/qifengle/char-polish; Q=/workspace/wt-charpolish/art-src/character/body-r1/scripts/qa_clash.py
cd $D/tools && POLISH_P="$2" python3 build_polish.py $D/before/heroine_live.glb /tmp/var_$1.glb 0.3 >/dev/null
for m in "" $D/anim_meta_e976a733.json; do GAME_MORPH=$m $B -b --python game_morph.py --python $Q -- /tmp/var_$1.glb /tmp/c_$1_${m:+m}.json /tmp/var_$1.glb > /tmp/c_$1_${m:+m}.log 2>&1 & done; wait
python3 - $1 <<'PY'
import json,sys;n=sys.argv[1]
for t in ('','m'):
    out={}
    for l in open(f'/tmp/c_{n}_{t}.log'):
        if l.startswith('CLIP'):
            c,d=l.split(' ',2)[1],json.loads(l.split(' ',2)[2])
            if c=='walk_loop_v2': continue
            hov=sum(v[0] for k,v in d['overlap_max'].items() if k.startswith('hand')); sov=sum(v[0] for k,v in d['overlap_max'].items() if k.startswith('sleeve'))
            gap=min([v[0] for k,v in d['min_gap_mm'].items() if k.startswith('hand')] or [99])
            out[c]=f"h{hov}/s{sov}/g{gap}"
    print(n,'MORPH' if t else 'RAW  ',out)
PY
