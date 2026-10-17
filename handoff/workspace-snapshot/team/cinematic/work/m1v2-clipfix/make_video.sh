#!/bin/bash
# before|after side-by-side at the game camera (portrait45 = 390x844 phone portrait, vfov 45; r24 = R24 plan, vfov 90)
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; O=/workspace/tmp-m1clip; F=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc; mkdir -p evidence/video
for cam in portrait45 r24; do
  for s in before after; do d=$O/seq_${s}_$cam; rm -rf $d; mkdir -p $d; i=0
    for f in $(seq 0 90); do ln -s $O/$s/${cam}_open_stand_f$(printf %03d $f).png $d/$(printf %04d $i).png; i=$((i+1)); done
    for f in $(seq 1 45); do ln -s $O/$s/${cam}_open_turn_f$(printf %03d $f).png $d/$(printf %04d $i).png; i=$((i+1)); done
  done
  for speed in 1 2; do
    out=evidence/video/m1v2_clipfix_before_after_${cam}$([ $speed = 2 ] && echo _halfspeed).mp4
    ffmpeg -loglevel error -y -framerate $((30/speed)) -i $O/seq_before_$cam/%04d.png -framerate $((30/speed)) -i $O/seq_after_$cam/%04d.png -filter_complex \
"[0]drawtext=fontfile=$F:text='修改前 v2g（pass2b 底）':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6[a];\
[1]drawtext=fontfile=$F:text='修改后 pass2c SRC + 真尺寸修正':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6[b];\
[a][b]hstack,drawtext=fontfile=$F:text='frame %{eif\:n\:d}  (0-90 起身, 91-135 转身)':x=10:y=h-34:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
      -r 30 -c:v libx264 -pix_fmt yuv420p -crf 20 $out && echo made $out
  done
done
