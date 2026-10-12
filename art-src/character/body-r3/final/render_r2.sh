_d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$_d/env.sh" ] && [ "$_d" != / ]; do _d=$(dirname "$_d"); done; . "$_d/env.sh"
set -e; cd "$(dirname "$0")"
R=../scripts/render.py; B="$BLENDER"
NEW=../chr_b_r5g2_body-r2_TEST.glb; NEWW=../chr_b_r5g2_body-r2_walk-v2_TEST.glb
mkdir -p raw/e60 raw/new
$B -b --python $R -- $E60 raw/e60 shots_r2.json >/dev/null 2>&1 &
$B -b --python $R -- $NEW raw/new shots_r2.json >/dev/null 2>&1 &
wait
for f in 1 6 10 14 20 24; do mkdir -p raw/walk_old/f$f raw/walk_new/f$f
  $B -b --python $R -- $W2 raw/walk_old/f$f shots_r2_pose.json walk_loop $f >/dev/null 2>&1 &
  $B -b --python $R -- $NEWW raw/walk_new/f$f shots_r2_pose.json walk_loop $f >/dev/null 2>&1 &
  wait; done
mkdir -p raw/sit_old raw/sit_new
$B -b --python $R -- $E60 raw/sit_old shots_r2_pose.json sit_hold 1 >/dev/null 2>&1 &
$B -b --python $R -- $NEW raw/sit_new shots_r2_pose.json sit_hold 1 >/dev/null 2>&1 &
wait; echo RENDERED
