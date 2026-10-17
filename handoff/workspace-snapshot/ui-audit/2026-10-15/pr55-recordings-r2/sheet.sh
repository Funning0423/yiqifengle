sheet () 
{ 
    f=$1;
    o=$2;
    shift 2;
    args="";
    i=0;
    for t in "$@";
    do
        ffmpeg -loglevel error -y -ss $t -i $f -frames:v 1 -vf "crop=375:${H:-812}:0:0,scale=220:-1,drawtext=text='$t':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black" /tmp/pr55sh_$i.png;
        args="$args -i /tmp/pr55sh_$i.png";
        i=$((i+1));
    done;
    ffmpeg -loglevel error -y $args -filter_complex "hstack=inputs=$i" $o;
    rm -f /tmp/pr55sh_*.png
}
