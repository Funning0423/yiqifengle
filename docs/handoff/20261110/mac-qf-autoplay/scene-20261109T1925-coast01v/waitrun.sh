#!/bin/bash
# wait (max 60 min) until no qf-lock-*, no DevTools, no Creator for 2 checks 30 s apart, then run go2.sh (which takes the lock atomically)
W=$HOME/qf-autoplay/scene-20261109T1925-coast01v; L=$W/out/waitrun.log
ok=0
for i in $(seq 1 120); do
  o=$(ls /tmp/qf-lock-* 2>/dev/null | tr '\n' ' '); d=$(ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/'); c=$(pgrep -f 'MacOS/CocosCreator ' | wc -l | tr -d ' ')
  if [ -z "$o" ] && [ "$d" = 0 ] && [ "$c" = 0 ]; then ok=$((ok+1)); else ok=0; fi
  [ $((i % 4)) = 1 ] && echo "$(TZ=America/New_York date +%T) locks=[$o] devtools=$d creator=$c ok=$ok" >> $L
  if [ $ok -ge 2 ]; then echo "$(TZ=America/New_York date +%T) START go3" >> $L; bash $W/go3.sh; echo "$(TZ=America/New_York date +%T) go3 rc=$?" >> $L; exit 0; fi
  sleep 30
done
echo "$(TZ=America/New_York date +%T) GAVE UP waiting" >> $L
