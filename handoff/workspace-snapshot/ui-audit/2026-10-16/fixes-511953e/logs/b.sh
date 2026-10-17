cd ~/qf-fx5-tmp; T=$PWD; cd repo
pgrep -f "MacOS/CocosCreator " >/dev/null && { echo OTHER_CREATOR; exit 6; }
echo "PREBUILD $(date) free $(df -k ~|tail -1|awk '{print $4}')"
C=/Users/<mac-user>/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator; P=$PWD/creator-build-project
rm -rf $P/library $P/temp $P/build
sz(){ find "$1" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1}END{print s+0}'; }
table(){ B=$1; echo "TOTAL $(sz $B)"; echo "ROOT $(find $B -type f -not -path '*/subpackages/*' -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; for d in $B/subpackages/*; do echo "SUB $(basename $d) $(sz $d)"; done; }
$C --project $P --build configPath=$T/wx.json > $T/wx.log 2>&1; echo "wx exit $?"
table $P/build/wechat-release
$C --project $P --build configPath=$T/webm.json > $T/web.log 2>&1; echo "web exit $?"
echo "POSTBUILD $(date) free $(df -k ~|tail -1|awk '{print $4}')"
git status --short --untracked-files=all | grep -v "^?? creator-build-project/\(build\|library\|temp\|local\|profiles\)/" > $T/gitstatus.txt; wc -l $T/gitstatus.txt; head -5 $T/gitstatus.txt
find $P/build -name '*.cconb' | wc -l
echo BUILD_DONE
