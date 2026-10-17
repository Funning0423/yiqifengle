cd /tmp/wt-b5; export PATH=/tmp/node-bin:$PATH DRACO3D=/tmp/draco/node_modules/draco3d QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript QF_CC_DTS=/home/box/cocos-projects/hello-wx/temp/declarations/cc.d.ts
export NODE_OPTIONS=--max-old-space-size=6144
T=tools/camera-frame-test;L=/tmp/b542t; mkdir -p $L
r(){ n=$1;shift; [ -f $L/$n.done ] && return; env "$@" > $L/$n.log 2>&1; echo "exit $?" >> $L/$n.log; touch $L/$n.done; }
r frames-default node $T/test_camera_frames.cjs
r frames-real-walk node $T/test_camera_frames.cjs --real-walk
#r frames-es5 QF_TS_TARGET=ES5 node $T/test_camera_frames.cjs
#r frames-es5-real-walk QF_TS_TARGET=ES5 node $T/test_camera_frames.cjs --real-walk
touch $L/ALL.done
