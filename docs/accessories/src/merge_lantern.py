# 测试 GLB：角色 + socket.lantern(父 hand.L) + prop_lantern 节点树（刚性挂接，绑定姿态下灯竖直；游戏内钟摆由 Cocos 程序摆）
import sys,os,json,struct,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from glb import G
from rig import glob
char,prop,out=sys.argv[1:4];SOCK=json.loads(os.environ.get('SOCK','[0.010,0.080,0.006]'))
g=G(char);j=g.j;raw=open(prop,'rb').read();JL=struct.unpack('<I',raw[12:16])[0];pj=json.loads(raw[20:20+JL]);pb=raw[20+JL+8:]
hand=[i for i,n in enumerate(j['nodes']) if n['name']=='hand.L'][0]
Hg=glob(j,hand);R=Hg[:3,:3]/np.linalg.norm(Hg[:3,:3],axis=0)
import math
def m2q(m):
    t=np.trace(m)
    if t>0: s=math.sqrt(t+1)*2;return [(m[2,1]-m[1,2])/s,(m[0,2]-m[2,0])/s,(m[1,0]-m[0,1])/s,0.25*s]
    i=int(np.argmax(np.diag(m)));k=[(1,2),(2,0),(0,1)][i];a,b=k;s=math.sqrt(1+m[i,i]-m[a,a]-m[b,b])*2
    q=[0,0,0,0];q[i]=0.25*s;q[a]=(m[a,i]+m[i,a])/s;q[b]=(m[b,i]+m[i,b])/s;q[3]=(m[b,a]-m[a,b])/s;return q
qinv=m2q(R.T)
while len(g.b)%4: g.b.append(0)
off=len(g.b);g.b+=pb;nbv=len(j['bufferViews']);nac=len(j['accessors']);nme=len(j['meshes']);nma=len(j['materials']);nn=len(j['nodes'])
for bv in pj['bufferViews']: bv=dict(bv);bv['byteOffset']=bv.get('byteOffset',0)+off;j['bufferViews'].append(bv)
for a in pj['accessors']: a=dict(a);a['bufferView']+=nbv;j['accessors'].append(a)
j['materials']+=pj['materials']
for m in pj['meshes']:
    for p in m['primitives']:
        p['attributes']={k:v+nac for k,v in p['attributes'].items()};p['indices']+=nac;p['material']+=nma
    j['meshes'].append(m)
j['nodes'].append({'name':'socket.lantern','translation':[float(x) for x in SOCK],'rotation':[float(x) for x in qinv],'children':[nn+1],
   'extras':{'parent':'hand.L（她的右手，骨架镜像）','note':'掌心中点 + 指根方向 +2.5cm + 掌心外 +1.0cm；旋转=绑定姿态下灯竖直'}})
for i,n in enumerate(pj['nodes']):
    n=dict(n)
    if 'children' in n: n['children']=[c+nn+1 for c in n['children']]
    if 'mesh' in n: n['mesh']+=nme
    j['nodes'].append(n)
j['nodes'][hand].setdefault('children',[]).append(nn)
j['asset'].setdefault('extras',{})['lantern_test']='测试用：prop_lantern_v1 挂 socket.lantern，不作交付角色'
g.save(out);print('MERGED',out)
