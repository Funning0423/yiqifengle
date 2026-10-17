#!/bin/bash
# b0c21d2 round: detached, resumable (frames/stills that exist are skipped), nice 19. Plan = frames.cjs (17 s walk + 1 s blend + hold).
D=/workspace/wechat-game/team/cinematic/work/lakeside-cam-20261017T0411Z; BL=/workspace/wechat-game/art/regions/lakeside/blend/lakeside_r5h3.blend; R=$D/scripts/render_lk.py; PL=$D/scripts/plan.json
run(){ nice -n 19 /workspace/tmp-lkcam/blender-5.2.2-linux-x64/blender -b $BL --python $R -- "$@" >> $D/renders/blender.log 2>&1; }
T=/workspace/tmp-lkcam/st; mkdir -p $T
echo "start $(date -Is)" >> $D/renders/progress.log
STOP=408; LAST=468
for sz in 360x780 390x520; do W=${sz%x*}; H=${sz#*x}
  # landing end (new) and fallback end: her standing, frame STOP
  for k in landing fallbackEnd boardWorld; do case $k in landing) n=landing_final_new_$sz;; fallbackEnd) n=landing_final_fallback_$sz;; boardWorld) n=board_new_$sz;; esac
    [ -s $D/stills/$n.png ] || { rm -rf $T/$n; run plan $PL W $W H $H mode journey variant new pose $sz:$k out $T/$n frames $STOP:$((STOP+1)):1 samples 16 && cp $T/$n/f00$STOP.png $D/stills/$n.png; }; done
done
echo "stills done $(date -Is)" >> $D/renders/progress.log
# journey every 2nd frame (12 fps, each shown twice in the 24 fps video); landing end + blend + board hold every frame (24 fps)
for v in new fallback; do run plan $PL W 360 H 780 mode journey variant $v out $D/renders/$v frames $((STOP-48)):$((LAST+1)):1 samples 4; echo "$v end frames $(ls $D/renders/$v | wc -l) $(date -Is)" >> $D/renders/progress.log; done
for v in new fallback; do run plan $PL W 360 H 780 mode journey variant $v out $D/renders/$v frames 0:$((STOP-48)):2 samples 4; echo "$v frames $(ls $D/renders/$v | wc -l) $(date -Is)" >> $D/renders/progress.log; done
rm -rf $T; touch $D/renders/.done
