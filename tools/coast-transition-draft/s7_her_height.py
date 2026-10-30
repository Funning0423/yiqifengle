#!/usr/bin/env python3
"""S7 her on-screen size, real model + skeletal pose, in-game lens (vertical fov), every 30 fps frame of S7 (60 fps frames.csv, even frames) up to 39.8 s.
Rule (Grok Bot 2026-10-30, final, option 1)：她的屏上高度 ≥0.06 且 ≥40 px 只算到 38.9 s（7 屏）；390x520 为短屏例外，≥38.5 px（比例仍 ≥0.06）；38.9 s 之后按棋盘构图验收，不设门限。
(English: for t <=38.9 s on all 7 screens her height fraction >=0.06 and >=40 px, except 390x520 which needs >=38.5 px (fraction still >=0.06);
after 38.9 s the board landing is judged on board composition and is not gated.)
Clips as played (s7_strip): idle until walk 35.575, walk_start, walk_loop from 37.108, walk_stop_bodyL from 38.358, idle after 39.825.
Writes tools/coast-board-lens/s7_her_size.json (samples + cam_digest); test_coast_board_lens.cjs enforces the rule and recomputes cam_digest
from ref_transition.json rows (so the numbers belong to this exact lens). usage: python3 s7_her_height.py [out_v4]
"""
import json,struct,numpy as np,csv,math,sys,os
import os
G=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
b=open(G,'rb').read();L=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+L]);o=20+L;BL=struct.unpack('<I',b[o:o+4])[0];bin_=b[o+8:o+8+BL]
CT={5126:np.float32,5121:np.uint8,5123:np.uint16,5125:np.uint32};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
    a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n=NC[a['type']];dt=np.dtype(CT[a['componentType']]);st=v.get('byteStride',n*dt.itemsize)
    base=v.get('byteOffset',0)+a.get('byteOffset',0);raw=np.frombuffer(bin_,np.uint8,count=st*(a['count']-1)+n*dt.itemsize,offset=base)
    out=np.stack([np.frombuffer(raw[k*st:k*st+n*dt.itemsize].tobytes(),dt) for k in range(a['count'])]) if st!=n*dt.itemsize else np.frombuffer(raw.tobytes(),dt).reshape(-1,n)
    out=out.astype(np.float64)
    if a.get('normalized'): out/=np.iinfo(dt).max
    return out
N=len(j['nodes']);par=[-1]*N
for i,n in enumerate(j['nodes']):
    for c in n.get('children',[]): par[c]=i
rest=[(np.array(n.get('translation',[0,0,0]),float),np.array(n.get('rotation',[0,0,0,1]),float),np.array(n.get('scale',[1,1,1]),float)) for n in j['nodes']]
def qm(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
clips={}
for a in j['animations']:
    chs=[];d=0
    for c in a['channels']:
        s=a['samplers'][c['sampler']];t=acc(s['input'])[:,0];v=acc(s['output']);d=max(d,t[-1]);chs.append((c['target']['node'],c['target']['path'],t,v,s.get('interpolation')=='STEP'))
    clips[a['name']]=(chs,d)
def samp(t,v,x,path,step):
    if x<=t[0]: return v[0]
    if x>=t[-1]: return v[-1]
    k=np.searchsorted(t,x)-1;u=(x-t[k])/(t[k+1]-t[k])
    if step: return v[k]
    if path=='rotation':
        a,b2=v[k],v[k+1]
        if a@b2<0:b2=-b2
        r=a*(1-u)+b2*u;return r/np.linalg.norm(r)
    return v[k]*(1-u)+v[k+1]*u
sk=j['skins'][0];JN=sk['joints'];IBM=acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
meshes=[]
for n in j['nodes']:
    if 'mesh' in n:
        for p in j['meshes'][n['mesh']]['primitives']:
            A=p['attributes'];meshes.append((acc(A['POSITION']),acc(A['JOINTS_0']).astype(int),acc(A['WEIGHTS_0'])))
P=np.concatenate([m[0] for m in meshes]);JI=np.concatenate([m[1] for m in meshes]);W=np.concatenate([m[2] for m in meshes]);W/=W.sum(1,keepdims=True)
ROOTS=j['scenes'][0]['nodes']
def pose(clip,x):
    trs=[list(r) for r in rest]
    chs,_=clips[clip]
    for nd,path,t,v,st in chs:
        k={'translation':0,'rotation':1,'scale':2}[path];trs[nd][k]=samp(t,v,x,path,st)
    M=[None]*N
    def wm(i):
        if M[i] is not None: return M[i]
        T,R,S=trs[i];m=np.eye(4);m[:3,:3]=qm(R)*S;m[:3,3]=T
        M[i]=(wm(par[i])@m) if par[i]>=0 else m;return M[i]
    for i in range(N): wm(i)
    S=np.stack([M[JN[k]]@IBM[k] for k in range(len(JN))])
    ph=np.c_[P,np.ones(len(P))];out=np.zeros((len(P),3))
    for c in range(4):
        out+=W[:,c:c+1]*np.einsum('nij,nj->ni',S[JI[:,c]],ph)[:,:3]
    return out

import json,math
O=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'out_v4')
T_SETTLE,EXC_SCREEN,EXC_FROM=39.8,'390x520',38.0
def clipat(t,WS,LS,SS,SE):
    if t<WS: return 'idle_breathing_loop',(t-WS)%1.8
    if t<LS: return 'walk_start',t-WS
    if t<SS: return 'walk_loop',(t-LS)%1.433
    if t<SE: return 'walk_stop_bodyL',min(1.467,t-SS)
    return 'idle_breathing_loop',(t-SE)%1.8
cache={};ALL={}
for s in ['390x844','414x896','360x780','375x667','320x568','390x520','768x1024']:
    w,h=map(int,s.split('x'));asp=w/h;rows=list(csv.DictReader(open(f'{O}/{s}/frames.csv')));e=json.load(open(f'{O}/{s}/end_pose.json'))
    t0=e['s7_start'];WS,SE=e['s7_walk'];LS,SS=WS+1.533,WS+2.783
    out=[];dig=[0]*7
    for r in rows:
        fr=int(r['frame']);t=fr/60
        if fr%2 or t<t0-1e-9 or t>T_SETTLE+1e-9: continue
        cn,ct=clipat(t,WS,LS,SS,SE);key=(cn,round(ct,3))
        if key not in cache: v=pose(cn,ct);v[:,0]-=v[:,0].mean();v[:,2]-=v[:,2].mean();cache[key]=v
        X=cache[key]+np.array([float(r['hx']),float(r['hy']),float(r['hz'])])
        cam=[float(r[k]) for k in ('px','py','pz','lx','ly','lz','fov')]
        for k in range(7): dig[k]+=round(round(cam[k],4)*1e4)
        p=np.array(cam[:3]);l=np.array(cam[3:6]);f=(l-p)/np.linalg.norm(l-p);rr=np.cross(f,[0,1,0]);rr/=np.linalg.norm(rr);u=np.cross(rr,f);d=X-p;z=d@f;th=math.tan(math.radians(cam[6])/2)
        sy=0.5-(d@u)/z/th/2;sx=0.5+(d@rr)/z/(th*asp)/2;hf=float(sy.max()-sy.min())
        out.append(dict(t=round(t,4),frac=round(hf,4),px=round(hf*h,1),on=bool(sx.min()>=0 and sx.max()<=1 and sy.min()>=0 and sy.max()<=1)))
    ALL[s]=dict(h=h,cam_digest=dig,samples=[[o['t'],o['frac'],o['px']] for o in out])
    g=[o for o in out if o['t']<=38.9+1e-9];mf=min(g,key=lambda o:o['frac']);mp=min(g,key=lambda o:o['px']);print(s,'<=38.9: frac',mf['frac'],'@',mf['t'],'px',mp['px'],'@',mp['t'],'n',len(out))
json.dump(dict(src='real model chr_b_r5g2 skinned (skeletal clips), in-game lens (vertical fov), 30 fps, S7 start..39.8 s; tools/coast-transition-draft/s7_her_height.py',cutoff=38.9,frac_min=0.06,px_min=40,exc={'390x520':38.5},screens=ALL),open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../coast-board-lens/s7_her_size.json'),'w'),separators=(',',':'))
