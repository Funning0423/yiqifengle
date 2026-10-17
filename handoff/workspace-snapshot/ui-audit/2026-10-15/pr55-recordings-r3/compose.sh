#!/bin/bash
# usage: compose.sh  -> converts raw webm to mp4 and makes side-by-side
cd "$(dirname "$0")"; mkdir -p mp4 sbs
for w in raw/*.webm; do b=$(basename $w .webm); [ -s mp4/$b.mp4 -a mp4/$b.mp4 -nt $w ] && continue
 ffmpeg -loglevel error -y -i $w -vf "crop=375:ih/2:0:0,scale=750:-2:flags=lanczos" -r 30 -c:v libx264 -pix_fmt yuv420p -crf 23 mp4/$b.mp4; done
for a in mp4/*_before_*.mp4; do b=$(basename $a .mp4); it=${b%%_*}; rest=${b#*_before_}
 other=after; [ $it = 12 -o $it = 13 ] && other=sail
 c=mp4/${it}_${other}_${rest}.mp4; [ -f $c ] || continue; [ -s sbs/${it}_before-vs-${other}_${rest}.mp4 ] && continue
 o=sbs/${it}_before-vs-${other}_${rest}.mp4
 da=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $a); dc=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $c)
 d=$(python3 -c "print(max($da,$dc))")
 ffmpeg -loglevel error -y -i $a -i $c -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=$d,drawtext=text='BEFORE':x=10:y=10:fontsize=36:fontcolor=red:box=1[l];[1:v]scale=iw*ih/ih:-2,tpad=stop_mode=clone:stop_duration=$d,drawtext=text='AFTER ($other)':x=10:y=10:fontsize=36:fontcolor=lime:box=1[r];[l][r]hstack[v]" -map "[v]" -t $d -r 30 -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p $o
done
