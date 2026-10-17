w=$1; b=$(basename $w .webm); [ -s mp4/$b.mp4 ] && exit 0
ffmpeg -loglevel error -y -i $w -vf "crop=375:ih/2:0:0,scale=750:-2" -r 30 -c:v libx264 -preset ultrafast -crf 26 -pix_fmt yuv420p mp4/$b.tmp.mp4 && mv mp4/$b.tmp.mp4 mp4/$b.mp4
