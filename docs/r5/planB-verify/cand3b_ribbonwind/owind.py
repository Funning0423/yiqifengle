# outward-only skirt wind: per skirt bone, take the wind delta rotation (vs f0), project its rotation vector on the 'outward tilt' axis
# (axis_world = down x outward_horizontal, outward = bone head - hips head, horizontal), rectify to [0, A_k] with f0 = 0
# (circular shift so the loop minimum sits at f0), drop twist/other components and translation deltas. Ribbon untouched.
import sys,json,fnmatch,numpy as np;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
SRC,OUT,K=sys.argv[1],sys.argv[2],json.loads(sys.argv[3])
J,B=load(SRC);B=bytearray(B);nodes=J['nodes']
par={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def qm(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def wm(i):
    n=nodes[i];T=np.eye(4);T[:3,:3]=qm(n.get('rotation',[0,0,0,1]))*np.array(n.get('scale',[1,1,1]));T[:3,3]=n.get('translation',[0,0,0])
    return wm(par[i])@T if i in par else T
nid={n.get('name'):i for i,n in enumerate(nodes)};hipW=wm(nid['hips'])[:3,3]
a=[a for a in J['animations'] if a['name']=='wind_flutter_loop'][0];log={}
def put(arr):
    global B
    while len(B)%4:B.append(0)
    o=len(B);b=arr.astype(np.float32).tobytes();B+=b;J['bufferViews'].append(dict(buffer=0,byteOffset=o,byteLength=len(b)))
    return o
for c in list(a['channels']):
    i=c['target']['node'];n=nodes[i]['name'];p=c['target']['path']
    k=next((v for kk,v in K.items() if fnmatch.fnmatchcase(n,kk)),None)
    if k is None or not n.startswith('skirt'):continue
    sm=a['samplers'][c['sampler']];v=acc(J,B,sm['output']).astype(np.float64);N=len(v)
    if p=='translation': nv=np.repeat(v[:1],N,0)
    elif p=='rotation':
        W=wm(i);R=W[:3,:3]/np.linalg.norm(W[:3,:3],axis=0);h=W[:3,3]-hipW;h[1]=0;o=h/np.linalg.norm(h)
        ax_w=np.cross([0,-1,0],o);ax_w/=np.linalg.norm(ax_w)
        # delta in local: d = q0^-1 q ; additive applies q_clip * d -> axis in the node's own (animated≈rest) frame
        Rr=qm(nodes[i].get('rotation',[0,0,0,1]));Wp=wm(par[i])[:3,:3];Wp=Wp/np.linalg.norm(Wp,axis=0);ax=(Wp@Rr).T@ax_w
        q0=v[0];inv=q0*np.array([-1,-1,-1,1])
        def mul(a_,b_):
            x1,y1,z1,w1=a_;x2,y2,z2,w2=b_.T;return np.stack([w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2],1)
        d=mul(inv,v);d=np.where(d[:,3:4]<0,-d,d);th=2*np.arccos(np.clip(d[:,3],-1,1));sn=np.sin(th/2);rv=np.where(sn[:,None]>1e-9,d[:,:3]/np.maximum(sn,1e-12)[:,None]*th[:,None],0)
        s=rv@ax;orig=np.degrees(np.abs(th).max());rng=s.max()-s.min()
        if rng<1e-9 or k<=0: nv=np.repeat(q0[None],N,0);A=0
        else:
            m=int(np.argmin(s[:-1]));L=N-1;sh=np.r_[s[:-1][m:],s[:-1][:m]];sh=np.r_[sh,sh[:1]]   # loop f0..f(N-1)=f0
            A=k*orig;ang=np.radians(A)*(sh-sh.min())/rng
            dn=np.concatenate([ax[None]*np.sin(ang/2)[:,None],np.cos(ang/2)[:,None]],1);nv=mul(q0,dn)
        log[n]=dict(orig_deg=round(float(orig),2),new_peak_deg=round(float(A),2),k=k,shift=int(m) if A else 0)
    else:continue
    o=put(nv);J['accessors'].append(dict(bufferView=len(J['bufferViews'])-1,componentType=5126,count=N,type='VEC4' if p=='rotation' else 'VEC3'))
    ns=dict(sm);ns['output']=len(J['accessors'])-1;a['samplers'].append(ns);c['sampler']=len(a['samplers'])-1
used=sorted(set(c['sampler'] for c in a['channels']));mp={o:i for i,o in enumerate(used)};a['samplers']=[a['samplers'][i] for i in used]
for c in a['channels']:c['sampler']=mp[c['sampler']]
save(OUT,J,bytes(B));print(json.dumps(log));json.dump(log,open(OUT+'.log.json','w'))
