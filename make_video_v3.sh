#!/bin/bash
# v3: 3-way side by side at the game camera: v2g | pass2c SRC | cs2 (constrained smooth), full + half speed
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; O=/workspace/tmp-m1clip; F=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc; mkdir -p evidence/video_v3
for cam in portrait45 r24; do
  for s in v2g src cs2; do d=$O/seq3_${s}_$cam; rm -rf $d; mkdir -p $d; i=0
    for f in $(seq 0 90); do ln -s $O/$s/${cam}_open_stand_f$(printf %03d $f).png $d/$(printf %04d $i).png; i=$((i+1)); done
    for f in $(seq 1 45); do ln -s $O/$s/${cam}_open_turn_f$(printf %03d $f).png $d/$(printf %04d $i).png; i=$((i+1)); done
  done
  fs=$([ $cam = r24 ] && echo 18 || echo 15)
  for speed in 1 2; do
    out=evidence/video_v3/m1v2_clipfix_v3_v2g_src_cs2_${cam}$([ $speed = 2 ] && echo _halfspeed).mp4
    ffmpeg -loglevel error -y -framerate $((30/speed)) -i $O/seq3_v2g_$cam/%04d.png -framerate $((30/speed)) -i $O/seq3_src_$cam/%04d.png -framerate $((30/speed)) -i $O/seq3_cs2_$cam/%04d.png -filter_complex \
"[0]drawtext=fontfile=$F:text='修改前 v2g':x=8:y=8:fontsize=$fs:fontcolor=white:box=1:boxcolor=black@0.6[a];\
[1]drawtext=fontfile=$F:text='pass2c SRC（逐帧，闪）':x=8:y=8:fontsize=$fs:fontcolor=white:box=1:boxcolor=black@0.6[b];\
[2]drawtext=fontfile=$F:text='v3 约束平滑 cs2（未通过：层间穿插）':x=8:y=8:fontsize=$fs:fontcolor=white:box=1:boxcolor=black@0.6[c];\
[a][b][c]hstack=inputs=3,drawtext=fontfile=$F:text='frame %{eif\:n\:d}  (0-90 起身, 91-135 转身; 闪烁窗口 36-41, 76-82)':x=10:y=h-30:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
      -r 30 -c:v libx264 -pix_fmt yuv420p -crf 20 $out && echo made $out
  done
done
