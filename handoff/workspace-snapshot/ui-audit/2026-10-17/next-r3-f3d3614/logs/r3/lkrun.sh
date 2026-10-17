# usage: lkrun.sh <srvtag> <mode...> ; env URLQ TAG VW VH QUICK
cd ~/qfl-a3b/r3
export QF_CHROMIUM_EXECUTABLE="$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
S=$1; shift
nohup python3 ../srv.py 8899 ~/qfl-a3b/web-r3 > srv_$S.log 2>&1 &
sleep 2
for m in "$@"; do node lk.cjs $m > lk_$m$TAG${VW:+_${VW}x$VH}.log 2>&1; echo "done $m$TAG $VW"; done
pkill -f "srv.py 8899"; sleep 1
