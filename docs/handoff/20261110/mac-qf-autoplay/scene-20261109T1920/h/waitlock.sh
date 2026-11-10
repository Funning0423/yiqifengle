#!/bin/bash
W=$HOME/qf-autoplay/scene-20261109T1920; LK=/tmp/qf-lock-scene-coast0203; LOG=$W/out/lock.log
for i in $(seq 1 1080); do
  others=$(ls /tmp/qf-lock-* 2>/dev/null | grep -v "^$LK$")
  dt=$(ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/')
  cr=$(pgrep -f "MacOS/CocosCreator " | wc -l | tr -d ' ')
  if [ -z "$others" ] && [ "$dt" = 0 ] && [ "$cr" = 0 ]; then
    if ( set -o noclobber; echo "owner=场景设计部 COAST02-03 M1 executor pid=$$ host=$(hostname) dir=~/qf-autoplay/scene-20261109T1920 start=$(TZ=America/New_York date '+%F %T EST')" > $LK ) 2>/dev/null; then
      echo "ACQUIRED $(TZ=America/New_York date)" >> $LOG; bash $W/h/m1-build.sh; echo "BUILD-EXIT $? $(TZ=America/New_York date)" >> $LOG; exit 0; fi
  fi
  [ $((i % 60)) = 1 ] && echo "$(TZ=America/New_York date '+%F %T') wait others=[$(for f in $others; do head -c 120 $f; done)] devtools=$dt creator=$cr" >> $LOG
  sleep 10
done
echo "TIMEOUT $(TZ=America/New_York date)" >> $LOG
