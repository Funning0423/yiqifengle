TS=scene-20261109T2215-fjord; W=$HOME/qf-autoplay/$TS; O=$W/out; LK=/tmp/qf-lock-scene-fjord
OWNER="owner=场景设计部 fjord import"
CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
export CREATOR=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator
export NODE=/Users/shineanl/.nvm/versions/node/v24.14.0/bin/node PATH=/Users/shineanl/.nvm/versions/node/v24.14.0/bin:$PATH
LSD="$HOME/Library/Application Support/微信开发者工具/d1e8765721a6c23d43b14c95b1843e6b/WeappLocalData"
FK(){ df -k ~ | awk 'NR==2{print $4}'; }
DT(){ ps -axo command= | grep -c '^/Applications/wechatwebdevtools.app/'; }
NOW(){ TZ=America/New_York date '+%F %T EST'; }
mylock(){ [ -f $LK ] && grep -q "^$OWNER" $LK; }
