#!/bin/bash
_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# quick self-check sheet: e60 / new / V12 / ref
cd "$(dirname "$0")/.."; OUT=${1:-/tmp/q.png}
B="$BLENDER"; R=scripts/render.py
mkdir -p previews/raw previews/raw_e60
$B -b --python $R -- chr_b_r5g2_body-r2_TEST.glb previews/raw data/shots_body.json >/dev/null 2>&1 &
$B -b --python $R -- chr_b_r5g2_body-r2_TEST.glb previews/raw data/shots_close.json >/dev/null 2>&1 &
$B -b --python $R -- chr_b_r5g2_body-r2_TEST.glb previews/raw data/shots_leg.json >/dev/null 2>&1 &
wait
python3 - "$OUT" <<'PY'
import sys
from PIL import Image
V=Image.open(__import__('os').environ['V12_REF']).convert('RGB')
import os;_fr=os.environ.get('FILM_REF','');F=Image.open(_fr).convert('RGB') if _fr and os.path.exists(_fr) else Image.new('RGB',(577,1000),(214,218,226))
T=lambda n:Image.open(f'previews/raw/{n}.png').convert('RGB')
cells=[V.crop((120,150,520,550)),F.crop((150,420,330,600)),T('b_front_noapron'),T('b_q34'),
       V.crop((60,560,480,980)) if V.height>900 else V.crop((0,0,10,10)),F.crop((180,560,330,740)),T('l_front'),T('l_shoe'),
       T('c_shoulder_front'),T('c_hand_out'),T('c_hand_front'),T('b_side')]
W=Image.new('RGB',(1600,1200),'white')
for i,c in enumerate(cells): W.paste(c.resize((400,400)),(400*(i%4),400*(i//4)))
W.save(sys.argv[1])
PY
