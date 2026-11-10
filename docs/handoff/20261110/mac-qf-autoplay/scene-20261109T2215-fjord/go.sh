#!/bin/bash
# P2 guarded TEST build of $REV (local test head, never pushed) with 4543a2fc tools/build-guard in the clone's repo root, default
# META_ALLOWLIST_BASE (unset -> merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2 = 4543a2fc). P3 DevTools 390x844 + 430x932.
. "$(dirname "$0")/common.sh"; exec >> $O/go.log 2>&1
REV=${REV:-qfb/qfx-test}; PHASE=${PHASE:-all}
echo "== GO start $PHASE $(NOW) free=$(FK)K rev=$REV"
mylock || { echo "NOT MY LOCK"; exit 7; }
trap 'rm -f $LK; echo "lock released $(NOW)"' EXIT
[ "$(DT)" = 0 ] || { echo "DEVTOOLS RUNNING"; exit 2; }
caffeinate -d -i -u -t 7200 & CAFG=$!
build(){
  [ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K"; return 3; }
  cd $W && rm -rf repo stage && git clone -q --no-checkout ~/yiqifengle repo && cd repo && git fetch -q $W/fjord.bundle 'refs/heads/*:refs/heads/qfb/*' && git checkout -q --detach $REV || { echo "STOP CLONE"; return 9; }
  git update-ref refs/remotes/origin/gbt/r5-b20-integrate-landing-visual-bg2 qfb/qfx-integ
  echo "[b] HEAD=$(git rev-parse HEAD) integ=$(git rev-parse origin/gbt/r5-b20-integrate-landing-visual-bg2) merge-base=$(git merge-base HEAD origin/gbt/r5-b20-integrate-landing-visual-bg2)"
  rm -rf $W/g88 && mkdir -p $W/g88 && tar -xf $W/guard88.tar -C $W/g88 || { echo NO GUARD; return 9; }
  (cd $W/g88 && find tools/build-guard -type f) | while read -r f; do
    [ "$f" = tools/build-guard/meta-allowlist.json ] && continue
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then cmp -s "$W/g88/$f" "$f" || { cp "$W/g88/$f" "$f"; git update-index --assume-unchanged "$f"; echo "  guard88 over $f"; }
    else mkdir -p "$(dirname "$f")"; cp "$W/g88/$f" "$f"; echo "/$f" >> .git/info/exclude; echo "  guard88 new $f"; fi
  done > $O/guard88-copy.txt; rm -rf $W/g88; echo "[b] guard 4543a2fc files changed/added: $(wc -l < $O/guard88-copy.txt)"; cat $O/guard88-copy.txt
  [ -z "$(git status --porcelain --untracked-files=all)" ] || { echo "[b] tree not clean after guard copy"; git status --porcelain | head; return 9; }
  unset META_ALLOWLIST_BASE
  QF_STAGE_ROOT=$W/stage LOG_DIR=$O/guard-logs STRIP_PROBES=0 KEEP_CACHE=0 bash tools/build-guard/build-wechat-guarded.sh wechat > $O/guard.log 2>&1; rc=$?
  echo "[b] guard rc=$rc"; grep -E "meta-allowlist|BUILD GUARD|WARN: Creator|PLACEHOLDER|FAIL|REJECTED|base chosen|scanned|exit=" $O/guard.log | head -30
  ph=$(grep 'PLACEHOLDER GATE PASS' $O/guard.log | tail -1 | grep -o 'hits in [0-9]* dir' | awk '{print $3}'); echo "[b] placeholder dirs scanned: ${ph:-none}"
  P=$PWD/creator-build-project
  if [ $rc = 0 ] && [ "${ph:-0}" = 0 ]; then echo "[b] PLACEHOLDER SCANNED 0 DIRS -> STOP"; cd $W; rm -rf repo stage; return 8; fi
  [ $rc = 0 ] && [ -d $P/build/wechat-release ] || { echo "[b] BUILD-FAIL"; cd $W; rm -rf repo stage; return 4; }
  for b in region_fjord region_hotspring region_cloudsea region_rail region_coast; do echo "[b] $b bytes: $(find $P/build/wechat-release/subpackages/$b -type f -exec stat -f %z {} + 2>/dev/null | awk '{s+=$1}END{print s}')"; done
  echo "[b] total bytes: $(find $P/build/wechat-release -type f -exec stat -f %z {} + | awk '{s+=$1}END{print s}')"
  (cd $P/build/wechat-release && find . -type f -exec stat -f '%z %N' {} +) | sort -k2 > $O/build-files.txt
  rm -rf $W/build; mv $P/build/wechat-release $W/build; cd $W; rm -rf repo stage; echo "[b] build done free=$(FK)K"; }
MYLS="${MYLS:-}"; NEWLS=""
setdev(){ [ -n "$MYLS" ] && [ -f "$LSD/$MYLS" ] || return 1; /usr/bin/python3 - "$LSD/$MYLS" $1 <<'PY'
import json,sys
p,i=sys.argv[1],int(sys.argv[2]);d=json.load(open(p));d['device']['current']=i;d['deviceInfo']=d['device']['list'][i]['info'];json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'));print('device set',i,d['deviceInfo']['screenWidth'],d['deviceInfo']['screenHeight'])
PY
}
getdev(){ /usr/bin/python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['device']['current'])" "$LSD/$MYLS" 2>/dev/null; }
U0=$(find "$HOME/Library/Application Support/微信开发者工具" -maxdepth 7 -type d -path '*wx3bdd911c5c06f591/usr' 2>/dev/null | head -1)
session(){ # $1 script  $2 device idx  $3 name
  S=$O/s-$3; rm -rf $S; mkdir -p $S; PJ=$W/${PJN:-proj}
  [ "$(DT)" = 0 ] || { echo "DEVTOOLS APPEARED, stop"; return 2; }
  mkdir -p $PJ && rsync -a --delete $W/build/ $PJ/ && node $W/h/inject.cjs $PJ --script $W/h/$1 > $S/inject.log 2>&1 || { echo "inject fail"; cat $S/inject.log; return 4; }
  python3 - "$PJ/qf-autoplay.js" "$W/h/$1" >> $S/inject.log 2>&1 <<'PY' || { echo "inline fail"; return 4; }
import sys,json
p,sf=sys.argv[1],sys.argv[2]; L=open(p).read().split('\n'); t=open(sf).read(); json.loads(t)
i=[k for k,l in enumerate(L) if l.startswith('var QF_SCENE_SCRIPT=')]; assert len(i)==1
L[i[0]]='var QF_SCENE_SCRIPT='+json.dumps(t)+';'; open(p,'w').write('\n'.join(L)); print('inline script', sf, len(json.loads(t)['steps']), 'steps')
PY
  [ -n "$U0" ] && [ -d "$U0/qf-autoplay/$TS" ] && rm -rf "$U0/qf-autoplay/$TS"
  [ -n "$MYLS" ] && [ "$(getdev)" != "$2" ] && setdev $2
  $CLI quit > $S/cliquit-pre.log 2>&1; for i in 1 2 3 4 5 6 7 8; do [ "$(DT)" = 0 ] && break; sleep 3; done; echo "[$3] pre-open cli quit done, devtools procs=$(DT) (cold start)"
  [ "$(DT)" = 0 ] || { echo "[$3] devtools still running after quit -> stop"; return 2; }
  ls "$LSD" > $S/ls-before.txt
  echo "[$3] screen locked? $(/usr/bin/python3 -c 'import Quartz;d=Quartz.CGSessionCopyCurrentDictionary();print(bool(d and d.get("CGSSessionScreenIsLocked")))' 2>/dev/null || echo unknown)"
  FRONT=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null)
  $CLI open --project $PJ > $S/cliopen.log 2>&1; echo "[$3] cli open rc=$? $(NOW)"; tail -3 $S/cliopen.log
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
  if [ -z "$MYLS" ]; then MYLS=$(for f in $(comm -13 <(sort $S/ls-before.txt) <(ls "$LSD" | sort) | grep '^localstorage_'); do grep -q '"device":{"current"' "$LSD/$f" && echo $f; done | head -1); echo "[$3] my localstorage: $MYLS"; fi
  NEWLS="$NEWLS $(comm -13 <(sort $S/ls-before.txt) <(ls "$LSD" | sort) | grep -v '^localstorage_00e87216' | tr '\n' ' ')"
  U=$(find "$HOME/Library/Application Support/微信开发者工具" -maxdepth 7 -type d -path '*wx3bdd911c5c06f591/usr' 2>/dev/null | head -1); R="$U/qf-autoplay/$TS"
  for i in $(seq 1 240); do sleep 5
    if [ -f "$R/result.json" ] && grep -q '"exit": "\(done\|error\|abandon\)' "$R/result.json"; then echo "[$3] RESULT DONE $(NOW)"; break; fi
    [ $((i % 24)) = 0 ] && echo "[$3] poll $i shots=$(ls "$R/shots" 2>/dev/null | wc -l)"
  done
  sleep 2; cp -R "$R/" $S/ev/ 2>/dev/null
  $CLI quit > $S/cliquit.log 2>&1; echo "[$3] cli quit rc=$?"; rm -rf "$R"
  for i in 1 2 3 4 5 6; do [ "$(DT)" = 0 ] && break; sleep 3; done; echo "[$3] devtools procs left: $(DT)"
  d=$(getdev); echo "[$3] device in localstorage after: $d (want $2)"
  grep -o '"exit": "[a-z]*"' $S/ev/result.json 2>/dev/null; ls $S/ev/shots 2>/dev/null | tr '\n' ' '; echo
  [ "$d" = "$2" ] || return 5; return 0; }
run(){ session "$@"; r=$?
  if [ ! -f $O/s-$3/ev/result.json ]; then echo "[$3] no result (simulator launch failed?) -> cli quit + one cold restart"; grep -h -i -E 'fail|error' $O/s-$3/cliopen.log | head -3; mv $O/s-$3 $O/s-$3-try1; session "$@"; r=$?; fi
  if [ $r = 5 ]; then echo "[$3] device mismatch -> set + rerun"; setdev $2 && session "$@"; r=$?; fi; return $r; }
if [ "$PHASE" = all ] || [ "$PHASE" = build ]; then build || { kill $CAFG; exit 4; }; fi
if [ "$PHASE" = all ] || [ "$PHASE" = play ]; then
  run script-fjord.json 7 fj-390x844
  run script-fjord.json 9 fj-430x932
  echo "new DevTools files this run: $NEWLS"
fi
kill $CAFG 2>/dev/null
echo "== GO-DONE $(NOW) free=$(FK)K devtools=$(DT)"
