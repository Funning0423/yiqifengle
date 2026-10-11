_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
set -e; cd "$(dirname "$0")"
R=../body-r1/scripts/render.py; B="$BLENDER"
NEW=../body-r1/chr_b_r5g2_body-r1_TEST.glb; NEWW=../body-r1/chr_b_r5g2_body-r1_walk-v2_TEST.glb
mkdir -p raw/e60 raw/r1 raw/new raw/blink raw/walk_old raw/walk_new
$B -b --python $R -- $E60 raw/e60 shots.json >/dev/null 2>&1 &
$B -b --python $R -- ../head-r1/chr_b_r5g2_head-r1_TEST.glb raw/r1 shots.json >/dev/null 2>&1 &
$B -b --python $R -- $NEW raw/new shots.json >/dev/null 2>&1 &
wait
for n in open half closed; do g=$NEW; [ $n != open ] && g=../body-r1/previews/blink_$n.glb
  $B -b --python $R -- $g raw/blink blink.json >/dev/null 2>&1; mv raw/blink/blink.png raw/blink/$n.png; done
for f in 1 10 14 24; do
  mkdir -p raw/walk_old/f$f raw/walk_new/f$f
  $B -b --python $R -- $W2 raw/walk_old/f$f shots_walk.json walk_loop $f >/dev/null 2>&1 &
  $B -b --python $R -- $NEWW raw/walk_new/f$f shots_walk.json walk_loop $f >/dev/null 2>&1 &
  wait
done
echo RENDERED
