#!/bin/bash
# 场景设计部 COAST02-03 M1 Mac build. Own dir only: $W. Never touches other bots' dirs.
TS=scene-20261109T1920; W=$HOME/qf-autoplay/$TS; O=$W/out; SHA=${SHA:-dd47465b}
export CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
export NODE=$(command -v node)
FK(){ df -k ~ | awk 'NR==2{print $4}'; }
mkdir -p $O; exec >> $O/build.log 2>&1
echo "== START $(TZ=America/New_York date) free=$(FK)K"
pgrep -f "MacOS/CocosCreator " >/dev/null && { echo "CREATOR RUNNING"; exit 2; }
[ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K"; exit 3; }
cd $W || exit 9
if [ ! -d repo/.git ]; then git clone -q --no-checkout ~/yiqifengle repo || { echo STOP CLONE; exit 9; }; fi
cd repo && git fetch -q $W/m1.bundle "+refs/heads/build/m1m2-mac:refs/heads/qf-m1" && git checkout -q -f qf-m1 && git reset -q --hard $SHA || { echo STOP CHECKOUT; exit 9; }
git config user.name Funning423; git config user.email shineanl@icloud.com
echo "HEAD=$(git rev-parse HEAD)"
P=$PWD/creator-build-project; rm -rf $P/library $P/temp $P/build
STOPK=2097152
run_creator(){ ( "$CREATOR" --project "$P" --build "configPath=$PWD/tools/build-guard/wechat-release.json" > $O/$1-creator.log 2>&1; echo $? > $O/$1.rc ) & BP=$!
  m=99999999; while kill -0 $BP 2>/dev/null; do f=$(FK); [ $f -lt $m ] && m=$f; [ $f -lt $STOPK ] && { echo DISKSTOP; CP=$(pgrep -P $BP); [ -n "$CP" ] && kill $CP; kill $BP; }; sleep 3; done; wait $BP
  echo "[$1] rc=$(cat $O/$1.rc) minfree=${m}K errors=$(grep -c ' - error:' $O/$1-creator.log) noscene=$(grep -c '当前初始场景不存在' $O/$1-creator.log) $(TZ=America/New_York date)"; }
run_creator p1
git status --porcelain --untracked-files=all | grep -vE '^\?\? creator-build-project/(build|library|temp|local|profiles)/' > $O/p1-status.txt; echo "p1 status lines $(wc -l < $O/p1-status.txt)"; cat $O/p1-status.txt | head -20
# only Creator's known balloon meta rewrite may be committed, LOCAL ONLY (never pushed)
if [ -s $O/p1-status.txt ]; then
  if grep -qv 'transport_balloon' $O/p1-status.txt; then echo "UNEXPECTED META CHANGES (not committing)"; fi
  git add -A -- $(awk '{print $2}' $O/p1-status.txt | grep transport_balloon) && git commit -q -m "LOCAL-ONLY: Creator balloon meta rewrite (do not push)" && echo "local balloon commit $(git rev-parse --short HEAD)"
fi
rm -rf $P/library $P/temp $P/build
echo "== guarded TEST build (STRIP_PROBES=0) free=$(FK)K"
QF_STAGE_ROOT=$W/stage LOG_DIR=$O/guard-test META_ALLOWLIST_BASE=HEAD STRIP_PROBES=0 KEEP_CACHE=1 PRELOAD_GATE=${PRELOAD_GATE:-1} bash tools/build-guard/build-wechat-guarded.sh wechat > $O/guard-test.log 2>&1; echo "guard-test rc=$?"; tail -25 $O/guard-test.log
if [ -d $P/build/wechat-release ]; then rm -rf $W/test-out; mv $P/build/wechat-release $W/test-out; fi
rm -rf $P/library $P/temp $P/build
echo "== guarded RELEASE build (STRIP_PROBES=1) free=$(FK)K"
if [ "$(FK)" -ge 2621440 ]; then
QF_STAGE_ROOT=$W/stage LOG_DIR=$O/guard-rel META_ALLOWLIST_BASE=HEAD STRIP_PROBES=1 KEEP_CACHE=0 bash tools/build-guard/build-wechat-guarded.sh wechat > $O/guard-rel.log 2>&1; echo "guard-rel rc=$?"; tail -25 $O/guard-rel.log
rm -rf $W/stage $P/build $P/library $P/temp
else echo "SKIP release build: disk $(FK)K"; fi
echo "== BUILD-DONE $(TZ=America/New_York date) free=$(FK)K"
