#!/bin/bash
# P1: first Creator 3.8.8 import of env_fjord.glb on 552b51e5 (throwaway clone). Collect what Creator writes; commit nothing here.
. "$(dirname "$0")/common.sh"; exec >> $O/p1.log 2>&1
echo "== P1 start $(NOW) free=$(FK)K"
mylock || { echo "NOT MY LOCK"; exit 7; }
[ "$(FK)" -ge 3145728 ] || { echo "DISK LOW $(FK)K -> stop"; exit 3; }
caffeinate -d -i -u -t 5400 & CAF=$!; echo "caffeinate pid $CAF"
for try in 1 2 3; do
  cd $W && rm -rf repo && git clone -q --no-checkout ~/yiqifengle repo && cd repo && git fetch -q $W/fjord.bundle 'refs/heads/*:refs/heads/qfb/*' && git checkout -q --detach qfb/qfx-fjord || { echo "STOP CLONE"; exit 9; }
  echo "[try $try] HEAD=$(git rev-parse HEAD)"
  "$CREATOR" --project $PWD/creator-build-project --build "configPath=$PWD/tools/build-guard/wechat-release.json" > $O/p1-creator.try$try.log 2>&1; rc=$?
  st=$(git status --porcelain --untracked-files=all | grep -vE '^\?\? creator-build-project/(build|library|temp|local|profiles)/')
  n=$(printf '%s\n' "$st" | grep -c .); bad=$(grep -c '当前初始场景不存在' $O/p1-creator.try$try.log)
  echo "[try $try] creator rc=$rc changed=$n initSceneErr=$bad errLines=$(grep -c ' - error:' $O/p1-creator.try$try.log) free=$(FK)K"
  if [ "$bad" = 0 ] && [ "$n" -lt 60 ]; then break; fi
  echo "[try $try] bad import -> retry"; cd $W; rm -rf repo
done
printf '%s\n' "$st" > $O/p1-status.txt; cat $O/p1-status.txt
git diff > $O/p1-diff.patch
paths=$(printf '%s\n' "$st" | sed 's/^...//'); COPYFILE_DISABLE=1 tar -cf $O/p1-metas.tar $paths && echo "tar ok $(tar -tf $O/p1-metas.tar | wc -l) files"
B=creator-build-project/build/wechat-release
if [ -d $B ]; then for b in region_fjord region_hotspring region_cloudsea region_rail; do echo "unguarded $b bytes: $(find $B/subpackages/$b -type f -exec stat -f %z {} + 2>/dev/null | awk '{s+=$1}END{print s}')"; done; echo "unguarded total: $(find $B -type f -exec stat -f %z {} + | awk '{s+=$1}END{print s}')"; fi
cd $W; rm -rf repo; kill $CAF 2>/dev/null
echo "== P1 done $(NOW) free=$(FK)K (lock kept for P2)"
