#!/bin/bash
# 场景设计部 COAST02-03 M1 DevTools run. One small window on the left, no focus steal, own PIDs only.
TS=scene-20261109T1920; W=$HOME/qf-autoplay/$TS; O=$W/out; T=$W/test-out; RUN=${RUN:-1}
CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
mkdir -p $O/play$RUN; L=$O/play$RUN/play.log; exec >> $L 2>&1
echo "== PLAY $RUN $(TZ=America/New_York date)"
[ "$(ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/')" = 0 ] || { echo "DEVTOOLS ALREADY RUNNING"; exit 2; }
[ -f $T/game.js ] || { echo "no test-out"; exit 3; }
if ! grep -q QF_AUTOPLAY $T/game.js; then node $W/h/inject.cjs $T --script $W/h/script-m1.json || exit 4; fi; cp $W/h/qf-autoplay.inline.js $T/qf-autoplay.js; cp $W/h/script-m1.json $T/qf-autoplay/script.json
FRONT=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null); echo "front before: $FRONT"
caffeinate -d -u -t 1800 & CAF=$!; echo $CAF > $O/play$RUN/caf.pid
$CLI open --project $T > $O/play$RUN/cliopen.log 2>&1; echo "cli open rc=$?"
# small window on the left (by window owner pid from CGWindowList); give focus back to whatever was frontmost
sleep 20; swift $W/h/wins.swift > $O/play$RUN/wins.txt 2>/dev/null   # no resize: resizing during launch re-triggers simulator compile
cat $O/play$RUN/wins.txt
[ -n "$FRONT" ] && osascript -e "tell application \"System Events\" to set frontmost of process \"$FRONT\" to true" 2>/dev/null
R=""
for i in $(seq 1 240); do sleep 5
  [ -z "$R" ] && R=$(find "$HOME/Library/Application Support/微信开发者工具" -type d -name "$TS" -path '*wx3bdd911c5c06f591/usr/qf-autoplay/*' 2>/dev/null | head -1) && [ -n "$R" ] && echo "R=$R"
  if [ -f "$R/result.json" ] && grep -q '"exit": "\(done\|error\|abandon\)' "$R/result.json"; then echo "RESULT DONE $(TZ=America/New_York date)"; break; fi
  [ $((i % 12)) = 0 ] && echo "poll $i $(ls "$R/shots" 2>/dev/null | wc -l) shots"
done
sleep 3
mkdir -p $O/play$RUN/ev; cp -R "$R/" $O/play$RUN/ev/ 2>/dev/null
$CLI quit > $O/play$RUN/cliquit.log 2>&1; echo "cli quit rc=$?"
kill $CAF 2>/dev/null
[ -n "$R" ] && case "$R" in *"/qf-autoplay/$TS") rm -rf "$R";; esac
sleep 5; echo "devtools procs left: $(ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/')"
echo "== PLAY-DONE $(TZ=America/New_York date)"
