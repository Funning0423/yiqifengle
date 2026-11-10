#!/bin/bash
# 场景设计部 COAST01 visual re-shoot (go5, 2026-11-09): ONE guarded TEST build of a LOCAL test-only merge (PR80 $PR80 + coast08-09
# $C67=c9aa9eb9, never pushed) + DevTools sessions 390x844 (full 01-09 + perf + journal) / 375x667 / 430x932 / kit-off 390x844, then
# perf_gate.py (390x844 idle fps >= 55, no long task > 100 ms; 08 visited without beacon; 09 visited; journal 9/9).
# Launch protocol (Grok Bot 11/09): before EVERY DevTools open: cli quit -> confirm no residual DevTools process -> cold start; a
# 'simulator launch failed' (DevTools double appservice-compile race) gets one more quit/verify/cold start. Own dir $W, lock $LK,
# own PIDs only (never pkill by pattern).
TS=scene-20261109T1925-coast01v; W=$HOME/qf-autoplay/$TS; O=$W/out; LK=/tmp/qf-lock-scene-coast01v
PR80=${PR80:-b72bb0c0}; C67=c9aa9eb9; BASE=17e478ead951cd77ef2550e998acee1c3c4e27ed; PHASE=${PHASE:-all}
CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
export CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
export NODE=/Users/shineanl/.nvm/versions/node/v24.14.0/bin/node PATH=/Users/shineanl/.nvm/versions/node/v24.14.0/bin:$PATH
LSD="$HOME/Library/Application Support/微信开发者工具/d1e8765721a6c23d43b14c95b1843e6b/WeappLocalData"
FK(){ df -k ~ | awk 'NR==2{print $4}'; }
DT(){ ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/'; }
mkdir -p $O; exec >> $O/go5.log 2>&1
U0=$(find "$HOME/Library/Application Support/微信开发者工具" -maxdepth 7 -type d -path '*wx3bdd911c5c06f591/usr' 2>/dev/null | head -1); echo "== go5 harness usr=$U0"
echo "== START $PHASE $(TZ=America/New_York date) free=$(FK)K pr80=$PR80 c67=$C67"
OTHER=$(ls /tmp/qf-lock-* 2>/dev/null | grep -v "^$LK$"); [ -n "$OTHER" ] && { echo "OTHER LOCK: $OTHER"; exit 7; }
[ "$(DT)" = 0 ] || { echo "DEVTOOLS RUNNING"; exit 2; }
pgrep -f "MacOS/CocosCreator " >/dev/null && { echo "CREATOR RUNNING"; exit 2; }
if [ -f $LK ] && grep -q '^owner=场景设计部 COAST01 visual' $LK; then echo "owner=场景设计部 COAST01 visual dir=$W pid=$$ start=$(date '+%F %T %Z') (adopted)" > $LK; echo "lock adopted"
else (set -C; echo "owner=场景设计部 COAST01 visual dir=$W pid=$$ start=$(date '+%F %T %Z')" > $LK) 2>/dev/null || { echo "LOCK TAKEN: $(cat $LK)"; exit 7; }; fi
trap 'rm -f $LK; echo "lock released $(TZ=America/New_York date)"' EXIT
build(){ # $1 rev  $2 tag
  [ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K"; return 3; }
  cd $W && rm -rf repo stage && git clone -q --no-checkout ~/yiqifengle repo && cd repo && git fetch -q $W/coastv5.bundle 'refs/heads/*:refs/heads/qfb/*' && git checkout -q --detach $1 || { echo "STOP CLONE $1"; return 9; }
  if [ -n "${3:-}" ]; then git -c user.name=qf-test-merge -c user.email=noreply@local merge -q --no-edit $3 > $O/merge-$2.log 2>&1 || { echo "[$2] MERGE CONFLICT"; cat $O/merge-$2.log; return 9; }; echo "[$2] LOCAL TEST MERGE $(git rev-parse HEAD) = $1 + $3 (not pushed)"; fi
  echo "[$2] HEAD=$(git rev-parse HEAD)"; P=$PWD/creator-build-project
  # Guard = integration @4543a2fc (PR #88) tools/build-guard, copied OVER this throwaway clone's tools/build-guard and run from the
  # repo root (never committed): changed tracked files are marked assume-unchanged and new files go to .git/info/exclude in THIS
  # clone only; meta-allowlist.json stays the tested rev's own (4543a2fc's is identical to 57b7a0fb's; PR80 adds 3 reviewed entries).
  rm -rf $W/g88 && mkdir -p $W/g88 && tar -xf $W/guard88.tar -C $W/g88 || { echo NO GUARD; return 9; }
  (cd $W/g88 && find tools/build-guard -type f) | while read -r f; do
    [ "$f" = tools/build-guard/meta-allowlist.json ] && continue
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then cmp -s "$W/g88/$f" "$f" || { cp "$W/g88/$f" "$f"; git update-index --assume-unchanged "$f"; echo "  guard88 over $f"; }
    else mkdir -p "$(dirname "$f")"; cp "$W/g88/$f" "$f"; echo "/$f" >> .git/info/exclude; echo "  guard88 new $f"; fi
  done > $O/guard88-copy-$2.txt; rm -rf $W/g88; echo "[$2] guard88 files changed/added: $(wc -l < $O/guard88-copy-$2.txt)"
  [ -z "$(git status --porcelain --untracked-files=all)" ] || { echo "[$2] tree not clean after guard copy"; git status --porcelain | head; return 9; }
  echo "[$2] guard=4543a2fc tools/build-guard in repo root free=$(FK)K"
  QF_STAGE_ROOT=$W/stage LOG_DIR=$O/guard-$2 META_ALLOWLIST_BASE=$BASE STRIP_PROBES=0 KEEP_CACHE=0 bash tools/build-guard/build-wechat-guarded.sh wechat > $O/guard-$2.log 2>&1; rc=$?
  echo "[$2] guard rc=$rc"; grep -E "meta-allowlist|BUILD GUARD|WARN: Creator|PLACEHOLDER|FAIL|die|ERROR|scanned" $O/guard-$2.log | head -14
  ph=$(grep 'PLACEHOLDER GATE PASS' $O/guard-$2.log | tail -1 | grep -o 'hits in [0-9]* dir' | awk '{print $3}'); echo "[$2] placeholder dirs scanned: ${ph:-none}"
  if [ $rc = 0 ] && [ "${ph:-0}" = 0 ]; then echo "[$2] PLACEHOLDER SCANNED 0 DIRS (or line missing) -> STOP"; cd $W; rm -rf repo stage; return 8; fi
  st=$(git status --porcelain --untracked-files=all | grep -vE '^\?\? creator-build-project/(build|library|temp|local|profiles)/'); [ -n "$st" ] && echo "[$2] post-build dirty: $st"
  [ $rc = 0 ] && [ -d $P/build/wechat-release ] || { echo "[$2] BUILD-FAIL"; cd $W; rm -rf repo stage; return 4; }
  for b in region_coast region_lakeside; do echo "[$2] $b bytes: $(find $P/build/wechat-release/subpackages/$b -type f -exec stat -f %z {} + 2>/dev/null | awk '{s+=$1}END{print s}')"; done
  echo "[$2] total bytes: $(find $P/build/wechat-release -type f -exec stat -f %z {} + | awk '{s+=$1}END{print s}')"
  rm -rf $W/build-$2; mv $P/build/wechat-release $W/build-$2; cd $W; rm -rf repo stage; echo "[$2] build done free=$(FK)K"; }
MYLS="${MYLS:-}"
setdev(){ [ -n "$MYLS" ] && [ -f "$LSD/$MYLS" ] || return 1; /usr/bin/python3 - "$LSD/$MYLS" $1 <<'PY'
import json,sys
p,i=sys.argv[1],int(sys.argv[2]);d=json.load(open(p));d['device']['current']=i;d['deviceInfo']=d['device']['list'][i]['info'];json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'));print('device set',i,d['deviceInfo']['screenWidth'],d['deviceInfo']['screenHeight'])
PY
}
getdev(){ /usr/bin/python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['device']['current'])" "$LSD/$MYLS" 2>/dev/null; }
LOGD="$HOME/Library/Application Support/微信开发者工具/d1e8765721a6c23d43b14c95b1843e6b/WeappLog/logs"
patchh(){ /usr/bin/python3 - $W/h/qf-autoplay.js <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
if 'longtaskMaxMs' in s: print('harness perf patch present'); sys.exit()
a="longtaskEntries:P.lt.length,"
assert s.count(a)==1, 'perfStop anchor'
s=s.replace(a,"longtaskEntries:P.lt.length,longtaskMaxMs:P.lt.length?Math.max.apply(null,P.lt):0,gapsOver100:gaps.filter(function(x){return x>100;}).length,")
open(p,'w').write(s); print('harness perf patch applied (longtaskMaxMs, gapsOver100)')
PY
}
quitcheck(){ # $1 session dir: cli quit, then require zero DevTools processes (ours: we hold the lock); never kill by pattern
  $CLI quit > $1/prequit.log 2>&1; echo "  pre-open cli quit rc=$?"
  for i in $(seq 1 15); do [ "$(DT)" = 0 ] && { echo "  no residual DevTools"; return 0; }; sleep 3; done
  echo "  RESIDUAL DevTools processes after cli quit:"; ps -axo pid=,command= | grep '^ *[0-9]* /Applications/wechatwebdevtools.app/' | cut -c1-160; return 2; }
launchwatch(){ # $1 marker file: wait for this open's WeappLog verdict (success / failed) up to 120 s
  for i in $(seq 1 60); do sleep 2
    f=$(find "$LOGD" -name '*.log' -newer $1 -size +20k 2>/dev/null)
    [ -n "$f" ] && grep -l 'simulator launch failed Error' $f >/dev/null 2>&1 && { echo failed; return; }
    [ -n "$f" ] && grep -l 'simulator launch success' $f >/dev/null 2>&1 && { echo success; return; }
  done; echo unknown; }
session(){ # $1 build tag  $2 script  $3 device idx  $4 session name
  S=$O/s-$4; rm -rf $S; mkdir -p $S; PJ=$W/${PJN:-proj}
  quitcheck $S || { echo "[$4] residual DevTools -> stop (not killing)"; return 2; }
  mkdir -p $PJ && rsync -a --delete $W/build-$1/ $PJ/ && node $W/h/inject.cjs $PJ --script $W/h/$2 > $S/inject.log 2>&1 || { echo "inject fail"; return 4; }
  python3 - "$PJ/qf-autoplay.js" "$W/h/$2" >> $S/inject.log 2>&1 <<'PY' || { echo "inline fail"; return 4; }
import sys,json
p,sf=sys.argv[1],sys.argv[2]; L=open(p).read().split('\n'); t=open(sf).read(); json.loads(t)
i=[k for k,l in enumerate(L) if l.startswith('var QF_SCENE_SCRIPT=')]; assert len(i)==1
L[i[0]]='var QF_SCENE_SCRIPT='+json.dumps(t)+';'; open(p,'w').write('\n'.join(L)); print('inline script', sf, len(json.loads(t)['steps']), 'steps')
PY
  [ -n "$U0" ] && [ -d "$U0/qf-autoplay/$TS" ] && rm -rf "$U0/qf-autoplay/$TS"
  [ -n "$MYLS" ] && [ "$(getdev)" != "$3" ] && setdev $3
  ls "$LSD" > $S/ls-before.txt
  FRONT=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null)
  caffeinate -d -u -t 1800 & CAF=$!
  touch $S/t-open; $CLI open --project $PJ > $S/cliopen.log 2>&1; echo "[$4] cold start: cli open rc=$? $(TZ=America/New_York date +%T)"
  LV=$(launchwatch $S/t-open); echo "[$4] simulator launch: $LV"
  if [ "$LV" = failed ]; then $CLI quit > $S/cliquit-fail.log 2>&1; kill $CAF 2>/dev/null; for i in $(seq 1 10); do [ "$(DT)" = 0 ] && break; sleep 3; done; echo "[$4] launch failed -> quit, devtools left $(DT)"; return 6; fi
  for i in 1 2 3 4 5; do sleep 2; osascript <<'OSA' 2>/dev/null
tell application "System Events"
  repeat with p in (every process whose name contains "wechatwebdevtools" or name contains "微信开发者工具")
    try
      repeat with w in windows of p
        try
          set position of w to {0, 25}
          set size of w to {520, 900}
        end try
      end repeat
    end try
  end repeat
end tell
OSA
  done
  [ -n "$FRONT" ] && osascript -e "tell application \"System Events\" to set frontmost of process \"$FRONT\" to true" 2>/dev/null
  if [ -z "$MYLS" ]; then MYLS=$(for f in $(comm -13 <(sort $S/ls-before.txt) <(ls "$LSD" | sort) | grep '^localstorage_'); do grep -q '"device":{"current"' "$LSD/$f" && echo $f; done | head -1); NEWLS="$NEWLS $(comm -13 <(sort $S/ls-before.txt) <(ls "$LSD" | sort) | grep '^localstorage_' | tr '\n' ' ')"; echo "[$4] my localstorage: $MYLS"; fi
  U=$(find "$HOME/Library/Application Support/微信开发者工具" -maxdepth 7 -type d -path '*wx3bdd911c5c06f591/usr' 2>/dev/null | head -1); R="$U/qf-autoplay/$TS"
  for i in $(seq 1 240); do sleep 5
    if [ -f "$R/result.json" ] && grep -q '"exit": "\(done\|error\|abandon\)' "$R/result.json"; then echo "[$4] RESULT DONE $(TZ=America/New_York date +%T)"; break; fi
  done
  sleep 2; cp -R "$R/" $S/ev/ 2>/dev/null
  $CLI quit > $S/cliquit.log 2>&1; echo "[$4] cli quit rc=$?"; kill $CAF 2>/dev/null; rm -rf "$R"
  for i in 1 2 3 4 5 6; do [ "$(DT)" = 0 ] && break; sleep 3; done; echo "[$4] devtools procs left: $(DT)"
  d=$(getdev); echo "[$4] device in localstorage after: $d (want $3)"
  grep -o '"exit": "[a-z]*"' $S/ev/result.json 2>/dev/null; ls $S/ev/shots 2>/dev/null | tr '\n' ' '; echo
  [ "$d" = "$3" ] || return 5; return 0; }
run(){ session "$@"; r=$?
  if [ $r = 6 ]; then echo "[$4] second cold start (launch race)"; session "$@"; r=$?; fi
  if [ $r = 5 ]; then echo "[$4] device mismatch -> set + rerun"; setdev $3 && session "$@"; r=$?; [ $r = 6 ] && { echo "[$4] second cold start"; session "$@"; r=$?; }; fi
  echo "[$4] session rc=$r"; return $r; }
if [ "$PHASE" = all ] || [ "$PHASE" = build ]; then
  build $PR80 after $C67 || exit 4   # the ONLY build: local test merge PR80 + coast08-09 c9aa9eb9 (renamed 08 「浪花接力」), never pushed
fi
if [ "$PHASE" = all ] || [ "$PHASE" = play ]; then
  patchh
  caffeinate -d -i -u -t 7200 & CAFALL=$!
  run after script-full.json 7 after-390x844      # iPhone 12/13 (Pro)  390x844: 01-09 + perf + 9/9 + journal
  run after script-size.json 1 after-375x667      # iPhone 6/7/8        375x667
  run after script-size.json 9 after-430x932      # iPhone 14 Pro Max   430x932
  run after script-kitoff.json 7 after-kitoff-390x844
  kill $CAFALL 2>/dev/null
  for f in $MYLS $NEWLS; do [ -f "$LSD/$f" ] && rm -f "$LSD/$f" && echo "removed my localstorage $f"; done
fi
if [ "$PHASE" = all ] || [ "$PHASE" = play ] || [ "$PHASE" = gate ]; then
  /usr/bin/python3 $W/perf_gate.py $O > $O/gate.json; echo "== GATE rc=$? $(/usr/bin/python3 -c "import json;g=json.load(open('$O/gate.json'))['gate'];print(json.dumps({k:g[k] for k in ('ALL_PASS','perf390','journal9of9')},ensure_ascii=False))")"
fi
echo "== GO5-DONE $(TZ=America/New_York date) free=$(FK)K devtools=$(DT)"
