set -x
cd ~/qfl-a3b/repo
shasum -a 256 ../r3.bundle
git fetch -q ../r3.bundle integration/build05-next-20261017T0818Z-r3:integration/build05-next-20261017T0818Z-r3 && git checkout -q integration/build05-next-20261017T0818Z-r3 && git log -1 --format='HEAD %H TREE %T' && git status --short | wc -l
export CREATOR="$HOME/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
bash tools/build-guard/build-wechat-guarded.sh both > ../guard_r3.out 2>&1; echo "guard exit $?"
B=creator-build-project/build
for d in wechat-release web-test; do (cd $B/$d && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 > ~/qfl-a3b/r3-files-$d.sha256); echo "$d files $(wc -l < ~/qfl-a3b/r3-files-$d.sha256) agg $(shasum -a 256 ~/qfl-a3b/r3-files-$d.sha256 | cut -c1-64)"; done
for d in $B/wechat-release/subpackages/* ; do echo "SUB $(basename $d) $(find $d -type f -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; done
echo "ROOT $(find $B/wechat-release -type f -not -path '*/subpackages/*' -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"
rm -rf ~/qfl-a3b/web-r3 && cp -R $B/web-test ~/qfl-a3b/web-r3 && rm -rf $B
echo BDONE
cd ~/qfl-a3b && bash r3/runall.sh > r3/runall.out 2>&1
