set -x
cd ~/qfl-a3b
while ! grep -q RUNALL_DONE r3/runall.out 2>/dev/null; do sleep 30; done
echo "WAITED_DONE $(date)"
D=~/qfl-a3b/diag; cd ~/qfl-a3b/repo || exit 1
shasum -a 256 $D/lakeside-water-fix-r3.bundle
git fetch -q $D/lakeside-water-fix-r3.bundle voice/build05-lakeside-water-fix-r3:refs/remotes/vb/fixr3 || exit 1
git checkout -q 10a78208412ca31b0903c7865feccefe9136f4bd || exit 1
echo "HEAD $(git rev-parse HEAD) PARENT $(git rev-parse HEAD^) TREE $(git rev-parse HEAD^{tree})"
git diff --stat f3d3614 HEAD
P=creator-build-project
CREATOR="$HOME/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
echo "free before build $(df -k ~ | tail -1 | awk '{print $4}') KiB"
ok=0
for t in 1 2 3; do
  rm -rf $P/library $P/temp $P/build/web-debug
  "$CREATOR" --project $P --build "configPath=$D/web-debug.json" > $D/creator_try$t.log 2>&1
  sz=$(find $P/build/web-debug -type f -exec wc -c {} + 2>/dev/null | awk '$2!="total"{s+=$1}END{print s+0}')
  nd=$(git status --porcelain --untracked-files=all | grep -v -E '^\?\? creator-build-project/(build|library|temp|local|profiles)/' | wc -l | tr -d ' ')
  echo "try $t size=$sz dirty=$nd"
  if [ "$sz" -gt 15000000 ] && ! grep -q '当前初始场景不存在' $D/creator_try$t.log && [ "$nd" = 0 ]; then ok=1; break; fi
  git diff --name-only -z -- '*.meta' | xargs -0 git checkout -- 2>/dev/null; git ls-files --others --exclude-standard -z -- '*.meta' | xargs -0 rm -f 2>/dev/null
done
rm -rf $P/library $P/temp
[ $ok = 1 ] || { echo DIAG_BUILD_FAIL; exit 2; }
rm -rf $D/web-debug; mv $P/build/web-debug $D/web-debug; rm -rf $P/build
(cd $D/web-debug && find . -type f | sort | xargs shasum -a 256) > $D/files-web-debug.sha256
echo "web-debug files $(wc -l < $D/files-web-debug.sha256) agg $(shasum -a 256 $D/files-web-debug.sha256 | cut -c1-64)"
grep -l "QF_LAKE_DIAG" -r $D/web-debug | head
git checkout -q integration/build05-next-20261017T0818Z-r3
cd ~/qfl-a3b/r3
export QF_CHROMIUM_EXECUTABLE="$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
nohup python3 ../srv.py 8898 $D/web-debug > $D/srv_diag.log 2>&1 &
sleep 2
PORT=8898 URLQ='?lakediag=1' QUICK=1 TAG=_diag node lk.cjs day > $D/lk_day_diag.log 2>&1
pkill -f "srv.py 8898"
cp raw/lk_day_diag* $D/ 2>/dev/null
grep -h "QF_LAKE_DIAG" $D/lk_day_diag.log raw/lk_day_diag*.json 2>/dev/null | head -5
echo DIAG_DONE
