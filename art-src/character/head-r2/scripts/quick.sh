_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
# quick iterate: build + render face shots + compare -> $1
set -e; cd "$(dirname "$0")/.."
true
"$BLENDER" -b --python ../body-r1/scripts/render.py -- chr_b_r5g2_head-r2_TEST.glb previews/raw data/shots_face.json 2>&1 | grep -E "Error|Traceback" || true
python3 scripts/cmp.py previews/raw /tmp/cmp_full.png
python3 -c "from PIL import Image; Image.open('/tmp/cmp_full.png').resize((900,600)).save('$1')"
