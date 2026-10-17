set -x
cd ~/qfl-a3b
cat ch/fb.* > full.bundle && shasum -a 256 full.bundle && rm -rf ch
git clone -q full.bundle repo && cd repo && git checkout -q 09a1b8e456fd38dadf632f627189883808307cbe && git log -1 --format='%H %T'
git fetch -q ../qfl-build05-a3b-a995c4158ff4.bundle HEAD:integration/build05-a3b-20261017T063646Z && git checkout -q integration/build05-a3b-20261017T063646Z && git log -1 --format='HEAD %H TREE %T' && git status --short | wc -l
export CREATOR="$HOME/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
bash tools/build-guard/build-wechat-guarded.sh both > ../guard.out 2>&1; echo "guard exit $?"
B=creator-build-project/build
for d in wechat-release web-test; do (cd $B/$d && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 > ~/qfl-a3b/files-$d.sha256); echo "$d files $(wc -l < ~/qfl-a3b/files-$d.sha256) agg $(shasum -a 256 ~/qfl-a3b/files-$d.sha256 | cut -c1-64)"; done
for d in $B/wechat-release/subpackages/* ; do echo "SUB $(basename $d) $(find $d -type f -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; done
rm -rf ~/qfl-a3b/web && cp -R $B/web-test ~/qfl-a3b/web
echo BDONE
