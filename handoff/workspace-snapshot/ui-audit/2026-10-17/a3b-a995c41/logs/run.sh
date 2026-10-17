cd ~/qfl-a3b
export QF_CHROMIUM_EXECUTABLE="$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
for m in day night; do
  nohup python3 srv.py 8899 ~/qfl-a3b/web > srv8899_$m.log 2>&1 &
  sleep 2
  node rec10.cjs $m > rec$m.log 2>&1
  pkill -f "srv.py 8899"; sleep 1
done
echo RECDONE >> recnight.log
