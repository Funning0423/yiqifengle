#!/bin/bash
# 场景设计部 M1–M3 Mac build (one guarded TEST build). Guard = 57b7a0fb tools/build-guard in a temp workspace ($W/gw), not committed.
TS=scene-20261109T1920; W=$HOME/qf-autoplay/$TS; O=$W/out; SHA=cd4b7363
export CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
export NODE=$(command -v node)
FK(){ df -k ~ | awk 'NR==2{print $4}'; }
mkdir -p $O; exec >> $O/build-m3.log 2>&1
echo "== START $(TZ=America/New_York date) free=$(FK)K"
pgrep -f "MacOS/CocosCreator " >/dev/null && { echo "CREATOR RUNNING"; exit 2; }
[ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K"; exit 3; }
cd $W/repo || exit 9
git fetch -q $W/m3.bundle "+refs/heads/build/m3-mac:refs/heads/qf-m3" && git checkout -q -f qf-m3 && git reset -q --hard $SHA && git clean -qfd creator-build-project/assets tools || { echo STOP CHECKOUT; exit 9; }
git branch -D qf-m1 >/dev/null 2>&1
echo "HEAD=$(git rev-parse HEAD) status=$(git status --porcelain --untracked-files=all | grep -vE '^\?\? creator-build-project/(build|library|temp|local|profiles)/' | wc -l)"
rm -rf creator-build-project/library creator-build-project/temp creator-build-project/build
rm -rf $W/gw; mkdir -p $W/gw && tar xzf $W/guard57.tgz -C $W/gw || exit 9
cd $W/gw && echo "guard dir $(pwd) files $(ls tools/build-guard | wc -l)"
REPO_ROOT=$W/repo LOG_DIR=$O/guard-m3 META_ALLOWLIST_BASE=17e478ea STRIP_PROBES=0 KEEP_CACHE=0 bash tools/build-guard/build-wechat-guarded.sh wechat > $O/guard-m3.log 2>&1; echo "guard-m3 rc=$?"
grep -E "GUARD HEAD|exit=|OK \[|ROOT |SUB |WARN|REJECT|PASS|FAIL|BUILD GUARD" $O/guard-m3.log
P=$W/repo/creator-build-project
if [ -d $P/build/wechat-release ]; then rm -rf $W/test-out; mv $P/build/wechat-release $W/test-out; echo "test-out ready"; fi
rm -rf $P/library $P/temp $P/build
echo "== BUILD-DONE $(TZ=America/New_York date) free=$(FK)K"
