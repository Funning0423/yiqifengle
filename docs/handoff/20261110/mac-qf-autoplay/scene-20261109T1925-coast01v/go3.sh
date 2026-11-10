#!/bin/bash
# 场景设计部 COAST01 visual v3: guarded TEST builds of a LOCAL test-only merge (PR80 $PR80 + coast06-07 $C67, never pushed) and of
# nothing else (single build) + DevTools perf/shots. Own dir $W, lock $LK, own PIDs only.
TS=scene-20261109T1925-coast01v; W=$HOME/qf-autoplay/$TS; O=$W/out; LK=/tmp/qf-lock-scene-coast01v
PR80=${PR80:-d551b5df}; C67=c9aa9eb9; BASE=17e478ead951cd77ef2550e998acee1c3c4e27ed; PHASE=${PHASE:-all}
CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
export CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
export NODE=/Users/shineanl/.nvm/versions/node/v24.14.0/bin/node PATH=/Users/shineanl/.nvm/versions/node/v24.14.0/bin:$PATH
LSD="$HOME/Library/Application Support/微信开发者工具/d1e8765721a6c23d43b14c95b1843e6b/WeappLocalData"
FK(){ df -k ~ | awk 'NR==2{print $4}'; }
DT(){ ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/'; }
mkdir -p $O; exec >> $O/go2.log 2>&1
echo "== START $PHASE $(TZ=America/New_York date) free=$(FK)K pr80=$PR80 c67=$C67"
OTHER=$(ls /tmp/qf-lock-* 2>/dev/null | grep -v "^$LK$"); [ -n "$OTHER" ] && { echo "OTHER LOCK: $OTHER"; exit 7; }
[ "$(DT)" = 0 ] || { echo "DEVTOOLS RUNNING"; exit 2; }
pgrep -f "MacOS/CocosCreator " >/dev/null && { echo "CREATOR RUNNING"; exit 2; }
(set -C; echo "owner=场景设计部 COAST01 visual dir=$W pid=$$ start=$(date '+%F %T %Z')" > $LK) 2>/dev/null || { echo "LOCK TAKEN: $(cat $LK)"; exit 7; }
trap 'rm -f $LK; echo "lock released $(TZ=America/New_York date)"' EXIT
build(){ # $1 rev  $2 tag
  [ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K"; return 3; }
  cd $W && rm -rf repo stage && git clone -q --no-checkout ~/yiqifengle repo && cd repo && git fetch -q $W/coastv4.bundle 'refs/heads/*:refs/heads/qfb/*' && git checkout -q --detach $1 || { echo "STOP CLONE $1"; return 9; }
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
MYLS=""
setdev(){ [ -n "$MYLS" ] && [ -f "$LSD/$MYLS" ] || return 1; /usr/bin/python3 - "$LSD/$MYLS" $1 <<'PY'
import json,sys
p,i=sys.argv[1],int(sys.argv[2]);d=json.load(open(p));d['device']['current']=i;d['deviceInfo']=d['device']['list'][i]['info'];json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'));print('device set',i,d['deviceInfo']['screenWidth'],d['deviceInfo']['screenHeight'])
PY
}
getdev(){ /usr/bin/python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['device']['current'])" "$LSD/$MYLS" 2>/dev/null; }
session(){ # $1 build tag  $2 script  $3 device idx  $4 session name
  S=$O/s-$4; rm -rf $S; mkdir -p $S; PJ=$W/proj
  [ "$(DT)" = 0 ] || { echo "DEVTOOLS APPEARED, stop"; return 2; }
  mkdir -p $PJ && rsync -a --delete $W/build-$1/ $PJ/ && node $W/h/inject.cjs $PJ --script $W/h/$2 > $S/inject.log 2>&1 || { echo "inject fail"; return 4; }
  [ -n "$MYLS" ] && setdev $3
  ls "$LSD" > $S/ls-before.txt
  FRONT=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null)
  caffeinate -d -u -t 1800 & CAF=$!
  $CLI open --project $PJ > $S/cliopen.log 2>&1; echo "[$4] cli open rc=$? $(TZ=America/New_York date +%T)"
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
  if [ -z "$MYLS" ]; then MYLS=$(comm -13 <(sort $S/ls-before.txt) <(ls "$LSD" | sort) | grep '^localstorage_' | head -1); echo "[$4] my localstorage: $MYLS"; fi
  U=$(find "$HOME/Library/Application Support/微信开发者工具" -maxdepth 4 -type d -path '*wx3bdd911c5c06f591/usr' 2>/dev/null | head -1); R="$U/qf-autoplay/$TS"
  for i in $(seq 1 240); do sleep 5
    if [ -f "$R/result.json" ] && grep -q '"exit": "\(done\|error\|abandon\)' "$R/result.json"; then echo "[$4] RESULT DONE $(TZ=America/New_York date +%T)"; break; fi
  done
  sleep 2; cp -R "$R/" $S/ev/ 2>/dev/null
  $CLI quit > $S/cliquit.log 2>&1; echo "[$4] cli quit rc=$?"; kill $CAF 2>/dev/null; rm -rf "$R"
  for i in 1 2 3 4 5 6; do [ "$(DT)" = 0 ] && break; sleep 3; done; echo "[$4] devtools procs left: $(DT)"
  d=$(getdev); echo "[$4] device in localstorage after: $d (want $3)"
  grep -o '"exit": "[a-z]*"' $S/ev/result.json 2>/dev/null; ls $S/ev/shots 2>/dev/null | tr '\n' ' '; echo
  [ "$d" = "$3" ] || return 5; return 0; }
run(){ session "$@"; r=$?; if [ $r = 5 ]; then echo "[$4] device mismatch -> set + rerun"; setdev $3 && session "$@"; r=$?; fi; return $r; }
if [ "$PHASE" = all ] || [ "$PHASE" = build ]; then
  build $PR80 after $C67 || exit 4   # the ONLY build: local test merge PR80 + coast08-09 (c9aa9eb9 contains cd4b7363), never pushed
fi
if [ "$PHASE" = all ] || [ "$PHASE" = play ]; then
  run after script-full.json 7 after-390x844
  run after script-size.json 1 after-375x667
  run after script-size.json 4 after-414x896
  run after script-kitoff.json 7 after-kitoff-390x844
  [ -n "$MYLS" ] && [ -f "$LSD/$MYLS" ] && rm -f "$LSD/$MYLS" && echo "removed my localstorage $MYLS"
fi
echo "== GO2-DONE $(TZ=America/New_York date) free=$(FK)K devtools=$(DT)"
