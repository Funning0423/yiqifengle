# usage: try.sh "px,py,pz" "tx,ty,tz" fov
python3 - "$@" <<'P'
import re,sys
f='/tmp/wt-b5/creator-build-project/assets/scripts/world-r1/RegionCameraData.ts';s=open(f).read()
s=re.sub(r"'yunjing-final': \{ position: \[[^\]]*\], target: \[[^\]]*\], fovVerticalDeg: [0-9.]+,",f"'yunjing-final': {{ position: [{sys.argv[1]}], target: [{sys.argv[2]}], fovVerticalDeg: {sys.argv[3]},",s);open(f,'w').write(s)
P
export DRACO3D=/tmp/draco/node_modules/draco3d QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript QF_CC_DTS=/home/box/cocos-projects/hello-wx/temp/declarations/cc.d.ts
bash run.sh | tail -1; /exec-daemon/node frame_chk.cjs /tmp/wt-b5 | tail -n +2
/exec-daemon/node evalf.cjs /tmp/wt-b5 frames_B5.json B51.csv cur 2.5409 | python3 -c "import json,sys;d=json.load(sys.stdin);print('clr',d['minClear'],'occ',d['occlFrames'],'x',d['crossCount'])"
python3 -c "
import csv;R=list(csv.DictReader(open('B51.csv')));S=[r for r in R if r['b5']=='1']
b=[float(r['t']) for r in S if float(r['feetNdcY_0.46'])<=-0.5];print('feet bad',len(b),b[-1:],'final feet/head',R[-1]['feetNdcY_0.46'][:6],R[-1]['headNdcY_0.46'][:6],'dist',R[-1]['horizDist'][:5],'occ t',[r['t'] for r in S if r['occHead'] or r['occFace'] or r['occChest']][:2])"
