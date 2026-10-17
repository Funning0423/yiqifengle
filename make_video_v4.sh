#!/bin/bash
# v4 half-speed game-camera before/after: (a) v2g | SRC+apron-ease, stand 0-90 + turn 1-45; (b) SRC | SRC+apron-ease, stand f0-15
cd /workspace/wechat-game/team/cinematic/work/m1v2-clipfix; O=/workspace/tmp-m1clip4; F=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc; mkdir -p evidence/video_v4
seq_link(){ s=$1; cam=$2; mode=$3; d=$O/seq_${mode}_${s}_$cam; rm -rf $d; mkdir -p $d; i=0
  if [ $mode = full ]; then L="$(for f in $(seq 0 90); do echo open_stand_f$(printf %03d $f); done; for f in $(seq 1 45); do echo open_turn_f$(printf %03d $f); done)"
  else L="$(for f in $(seq 0 15); do echo open_stand_f$(printf %03d $f); done)"; fi
  for n in $L; do ln -s $O/$s/${cam}_$n.png $d/$(printf %04d $i).png; i=$((i+1)); done; }
for cam in r24 portrait45; do fs=$([ $cam = r24 ] && echo 18 || echo 15)
  for pair in "full v2g ease 修改前_v2g SRC+围裙缓入(采用)" "f15 src ease pass2c_SRC SRC+围裙缓入(f3-6)"; do set -- $pair; mode=$1; A=$2; Bv=$3; la=$4; lb=$5
    seq_link $A $cam $mode; seq_link $Bv $cam $mode
    for fps in 15 7.5; do [ $mode = full ] && [ $fps = 7.5 ] && continue
    sp=$([ $fps = 15 ] && echo halfspeed || echo quarterspeed); spz=$([ $fps = 15 ] && echo 半速 || echo 1/4速)
    out=evidence/video_v4/m1v2_v4_${A}_vs_src_apron_ease_${cam}_$([ $mode = f15 ] && echo f0-15_)$sp.mp4
    [ $mode = f15 ] && lbl="f0-15 起身开始, $spz" || lbl='0-90 起身, 91-135 转身, 半速'
    ffmpeg -loglevel error -y -framerate $fps -i $O/seq_${mode}_${A}_$cam/%04d.png -framerate $fps -i $O/seq_${mode}_${Bv}_$cam/%04d.png -filter_complex \
"[0]drawtext=fontfile=$F:text='$la':x=8:y=8:fontsize=$fs:fontcolor=white:box=1:boxcolor=black@0.6[a];[1]drawtext=fontfile=$F:text='$lb':x=8:y=8:fontsize=$fs:fontcolor=white:box=1:boxcolor=black@0.6[b];\
[a][b]hstack=inputs=2,drawtext=fontfile=$F:text='frame %{eif\:n\:d}  ($lbl)':x=10:y=h-30:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
      -r 30 -c:v libx264 -pix_fmt yuv420p -crf 20 $out && echo made $out
    done
  done; done
