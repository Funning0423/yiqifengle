cd ~/qf-ib-tmp; T=$PWD; cd repo
pgrep -fl CocosCreator && { echo OTHER_CREATOR; exit 6; }
echo "PREBUILD $(date) free $(df -k ~|tail -1|awk '{print $4}')"
C=/Users/<mac-user>/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator; P=$PWD/creator-build-project
sz(){ find "$1" -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1}END{print s+0}'; }
table(){ B=$1; echo "TOTAL $(sz $B)"; echo "ROOT $(find $B -type f -not -path '*/subpackages/*' -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; for d in $B/subpackages/*; do echo "SUB $(basename $d) $(sz $d)"; done; echo "LKFILES $(find $B -path '*region_lakeside*' -name '*cf4e4fee-4c2b-5817-a6d5-08f145e4b0c8*' -exec stat -f%z {} + | awk '{s+=$1;n++}END{print n+0, s+0}')"; }
$C --project $P --build configPath=$T/wx.json > $T/wx.log 2>&1; echo "wx exit $?"
B=$P/build/wechat-release; table $B
TOT=$(sz $B); if [ $TOT -gt 25165824 ]; then echo OVER_HARD; rm -rf $P/library $P/temp; exit 9; fi
$C --project $P --build configPath=$T/webm.json > $T/web.log 2>&1; echo "web exit $?"
echo "POSTBUILD $(date) free $(df -k ~|tail -1|awk '{print $4}')"; echo GITSTATUS; git status --short --untracked-files=all | grep -v "^?? creator-build-project/\(build\|library\|temp\|local\|profiles\)/" | head
python3 - $B $P/build/web-test <<'P'
import os,sys
for root in sys.argv[1:]:
 for dp,_,fs in os.walk(root):
  for f in fs:
    if not f.endswith(('.js','.json')):continue
    t=open(os.path.join(dp,f),encoding='utf8',errors='ignore').read()
    for s in ['独立测试进度','测试包','地区流程测试','流程参考占位']:
      esc=''.join('\\u%04x'%ord(c) for c in s)
      if s in t or esc in t: print('STR',s,os.path.join(dp,f)[-60:])
print('STRSCAN done')
P
M=creator-build-project/assets/bundles/region_lakeside/models/LK_terrain.glb.meta
python3 -c "import json;p='$M';j=json.load(open(p));j['userData']['meshCompress']['enable']=False;json.dump(j,open(p,'w'),indent=2)"
$C --project $P --build configPath=$T/wx2.json > $T/wx2.log 2>&1; echo "wx2(lk off) exit $?"
echo "== LK OFF"; table $P/build/wechat-lkoff
git checkout -- $M; git status --short $M; echo "META RESTORED"
rm -rf $P/build/wechat-lkoff $P/library $P/temp; echo "DONE free $(df -k ~|tail -1|awk '{print $4}')"
