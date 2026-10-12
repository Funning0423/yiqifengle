_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
set -e; cd "$(dirname "$0")"
R=../scripts/render.py; B="$BLENDER"
R2=../../body-r2/chr_b_r5g2_body-r2_TEST.glb
NEW=../chr_b_r5g2_body-r3_TEST.glb; NEWW=../chr_b_r5g2_body-r3_walk-v2_TEST.glb
mkdir -p raw/new raw/sit_new
if [ "$1" = extra ]; then   # one-off: extra shots for e60 / r2
  $B -b --python $R -- $E60 raw/e60 shots_r3_extra.json >/dev/null 2>&1 &
  $B -b --python $R -- $R2 raw/r2 shots_r3_extra.json >/dev/null 2>&1 &
  wait; exit 0; fi
$B -b --python $R -- $NEW raw/new shots_r2.json >/dev/null 2>&1 &
$B -b --python $R -- $NEW raw/new shots_r3_extra.json >/dev/null 2>&1 &
wait
for f in 1 6 10 24; do mkdir -p raw/walk_new/f$f; $B -b --python $R -- $NEWW raw/walk_new/f$f shots_r2_pose.json walk_loop $f >/dev/null 2>&1 & done; wait
$B -b --python $R -- $NEW raw/sit_new shots_r2_sit.json sit_hold 1 >/dev/null 2>&1
echo RENDERED
