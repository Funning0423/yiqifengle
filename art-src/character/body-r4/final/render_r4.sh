#!/bin/bash
# body-r4 review renders -> final/raw/{new,e60,blink_*,act}; sheets: python3 sheets_r4.py
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
set -e; cd "$(dirname "$0")"
R=../scripts/render.py; B="$BLENDER"; NEW=../chr_b_r5g2_body-r4_TEST.glb; NEWW=../chr_b_r5g2_body-r4_walk-v2_TEST.glb
HS=../../head-hy/data/shots_head.json
mkdir -p raw/new raw/e60 raw/act
$B -b --python $R -- $NEW raw/new shots_r4_final.json >/dev/null 2>&1 &
$B -b --python $R -- $E60 raw/e60 shots_r4_final.json >/dev/null 2>&1 &
$B -b --python $R -- $NEW raw/new $HS >/dev/null 2>&1 &
wait
# blink from the .blend: the GLB has no _tag_eyes group
for b in "open 0,0" "half 0,0.5" "closed 0.5,0"; do set -- $b; mkdir -p raw/blink_$1; BLINK=$2 $B -b --python $R -- ../body_r4_work.blend raw/blink_$1 $HS >/dev/null 2>&1 & done; wait
# key action frames (first / middle / last frame of every clip + walk_loop v2), 3/4 front view
python3 - "$NEW" > raw/act/list.txt <<'EOF'
import json,struct,sys
b=open(sys.argv[1],'rb').read(); L=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+L])
for a in J['animations']:
    n=int(round(max(J['accessors'][s['input']]['max'][0] for s in a['samplers'])*30))
    print(a['name'],0,n//2,n)
EOF
echo '[{"name":"A","az":30,"target":[0,0,0.85],"scale":1.95,"res":[330,560]}]' > raw/act/shot.json
while read c f0 f1 f2; do for f in $f0 $f1 $f2; do
  mkdir -p raw/act/$c/$f; $B -b --python $R -- $NEW raw/act/$c/$f raw/act/shot.json $c $f >/dev/null 2>&1 &
  while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 0.5; done; done; done < raw/act/list.txt
mkdir -p raw/act/walk_loop_v2
for f in 0 8 17; do mkdir -p raw/act/walk_loop_v2/$f; $B -b --python $R -- $NEWW raw/act/walk_loop_v2/$f raw/act/shot.json walk_loop $f >/dev/null 2>&1 & done
wait; echo RENDERED
