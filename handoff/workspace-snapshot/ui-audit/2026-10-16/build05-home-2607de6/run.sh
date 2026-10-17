set -x
cd ~/qf-h-tmp; T=$PWD
echo "START $(date) free $(df -k ~|tail -1|awk '{print $4}')"
git init -q repo; cd repo; git remote add origin https://github.com/Funning0423/yiqifengle.git; git remote set-url --push origin DISABLED
git fetch -q --depth 1 origin 751905c985e4e0c898f395456c3b2a41ff7a1376 || exit 2
git fetch -q $T/b.bundle la2-base:la2-base && git checkout -q la2-base || exit 3
for p in p1 p2 p3 p4 p5; do git -c user.name=audit -c user.email=a@l am -q $T/$p.patch || exit 4; echo "$p tree $(git rev-parse HEAD^{tree})"; done
echo "FINALTREE $(git rev-parse HEAD^{tree})"; git remote -v
[ "$(git rev-parse HEAD^{tree})" = 9a5e289be2101f9f78351a3c11c63e91f5bb7d0e ] || exit 5
pgrep -fl CocosCreator && exit 6
F=$(df -k ~|tail -1|awk '{print $4}'); echo "PREBUILD free $F"; [ $F -lt 3000000 ] && { echo LOWDISK; exit 7; }
C=/Users/<mac-user>/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator; P=$PWD/creator-build-project
$C --project $P --build configPath=$T/wx.json > $T/wx.log 2>&1; echo "wx exit $?"
$C --project $P --build configPath=$T/web.json > $T/web.log 2>&1; echo "web exit $?"
echo "POSTBUILD free $(df -k ~|tail -1|awk '{print $4}')"; git status --short
B=$P/build/wechat-release; echo "TOTAL $(find $B -type f -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; echo "ROOT $(find $B -type f -not -path '*/subpackages/*' -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"
for d in $B/subpackages/*; do echo "SUB $(basename $d) $(find $d -type f -exec stat -f%z {} + | awk '{s+=$1}END{print s}')"; done
python3 - $B <<'P'
import os,sys
for dp,_,fs in os.walk(sys.argv[1]):
  for f in fs:
    if not f.endswith(('.js','.json')):continue
    t=open(os.path.join(dp,f),encoding='utf8',errors='ignore').read()
    for s in ['独立测试进度','测试包','地区流程测试','回主页']:
      esc=''.join('\\u%04x'%ord(c) for c in s)
      if s in t or esc in t: print('STR',s,os.path.join(dp,f)[-50:])
P
rm -rf $P/library $P/temp; echo "LIBCLEAN free $(df -k ~|tail -1|awk '{print $4}')"
cd $P/build/web-rec && (python3 -m http.server 8861 --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > $T/server.pid); sleep 2; cd $T
export QF_CHROMIUM_EXECUTABLE=/Users/<mac-user>/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell
for m in day night; do for i in 25 24; do AUDIO=1 node rec4.cjs h $i $m p750 > rec_${i}_$m.log 2>&1; echo "REC $i $m $?"; done; done
echo "RECDONE $(date) free $(df -k ~|tail -1|awk '{print $4}')"
