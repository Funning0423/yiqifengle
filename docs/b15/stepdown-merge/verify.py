import sys,json,hashlib,numpy as np;from glb_io import *
BASE,NEW,DENSE=sys.argv[1:4]
J0,B0=load(BASE);J1,B1=load(NEW);JD,BD=load(DENSE);R={}
def h(J,B,i):return hashlib.sha1(acc(J,B,i).astype(np.float32).tobytes()).hexdigest()
# 1 其他 clip 逐通道
bad=[]
for a0 in J0['animations']:
    a1=[a for a in J1['animations'] if a['name']==a0['name']][0]
    if len(a0['channels'])!=len(a1['channels']):bad.append((a0['name'],'nch'))
    for c0,c1 in zip(a0['channels'],a1['channels']):
        s0=a0['samplers'][c0['sampler']];s1=a1['samplers'][c1['sampler']]
        if c0['target']!=c1['target'] or s0.get('interpolation','LINEAR')!=s1.get('interpolation','LINEAR') or h(J0,B0,s0['input'])!=h(J1,B1,s1['input']) or h(J0,B0,s0['output'])!=h(J1,B1,s1['output']):bad.append((a0['name'],c0['target']))
R['other_clips']=dict(n=len(J0['animations']),channels=sum(len(a['channels']) for a in J0['animations']),diff=bad,order_same=[a['name'] for a in J0['animations']]==[a['name'] for a in J1['animations']][:len(J0['animations'])],new=[a['name'] for a in J1['animations']][len(J0['animations']):])
# 2 节点/蒙皮/网格
R['nodes_same']=J0['nodes']==J1['nodes'];R['skins_same']=J0['skins']==J1['skins'];R['joints']=len(J1['skins'][0]['joints'])
R['ibm_same']=h(J0,B0,J0['skins'][0]['inverseBindMatrices'])==h(J1,B1,J1['skins'][0]['inverseBindMatrices'])
mb=[]
for m0,m1 in zip(J0['meshes'],J1['meshes']):
    if m0!=m1:mb.append(m0['name']);continue
    for p in m0['primitives']:
        ids=list(p['attributes'].values())+[p['indices']]+[v for t in p.get('targets',[]) for v in t.values()]
        for i in ids:
            if J0['accessors'][i]!=J1['accessors'][i]:mb.append((m0['name'],i))
R['base_bin_prefix_identical']=B1[:len(B0)]==B0;R['base_bufferViews_identical']=J1['bufferViews'][:len(J0['bufferViews'])]==J0['bufferViews'];R['base_accessors_identical']=J1['accessors'][:len(J0['accessors'])]==J0['accessors'];R['extensions_same']=J0.get('extensionsUsed')==J1.get('extensionsUsed') and J0.get('extensions')==J1.get('extensions')
R['meshes']=dict(n=len(J1['meshes']),diff=mb);R['materials_images_same']=all(J0.get(k)==J1.get(k) for k in ('materials','textures','images','samplers','scenes','scene'))
R['interp_explicit']=[s.get('interpolation') for a in J1['animations'] for s in a['samplers'] if 'interpolation' in s][:3]
# 3 新 clip 30fps 回读 vs 压缩前
def qn(q):return q/np.linalg.norm(q,axis=-1,keepdims=True)
def slerp(a,b,u):
    d=np.sum(a*b,-1,keepdims=True);b=np.where(d<0,-b,b);d=np.abs(d);th=np.arccos(np.clip(d,-1,1));s=np.sin(th)
    return qn(np.where(s>1e-9,np.sin((1-u)*th)/np.maximum(s,1e-12),1-u)*a+np.where(s>1e-9,np.sin(u*th)/np.maximum(s,1e-12),u)*b)
def samp(t,v,tq,rot):
    if len(t)==1:return np.repeat(v[:1],len(tq),0)
    j=np.clip(np.searchsorted(t,tq,'right')-1,0,len(t)-2);u=np.clip((tq-t[j])/(t[j+1]-t[j]),0,1)[:,None]
    return slerp(v[j],v[j+1],u) if rot else v[j]+(v[j+1]-v[j])*u
tq=np.arange(53)/30
def pose(J,B,name):
    a=[a for a in J['animations'] if a['name']==name][0];P={}
    nm=[n['name'] for n in J['nodes']]
    for i,n in enumerate(J['nodes']):P[nm[i]]=dict(translation=np.repeat([n.get('translation',[0,0,0])],53,0).astype(float),rotation=np.repeat([n.get('rotation',[0,0,0,1])],53,0).astype(float),scale=np.repeat([n.get('scale',[1,1,1])],53,0).astype(float))
    for c in a['channels']:
        s=a['samplers'][c['sampler']];v=acc(J,B,s['output']);rot=c['target']['path']=='rotation'
        P[nm[c['target']['node']]][c['target']['path']]=samp(acc(J,B,s['input']).ravel(),qn(v) if rot else v,tq,rot)
    return P,J
def mat(t,q,s):
    x,y,z,w=q;M=np.eye(4);M[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])*s;M[:3,3]=t;return M
def world(P,J,f):
    par={};nm=[n['name'] for n in J['nodes']]
    for i,n in enumerate(J['nodes']):
        for c in n.get('children',[]):par[nm[c]]=nm[i]
    W={}
    def g(n):
        if n in W:return W[n]
        L=mat(P[n]['translation'][f],P[n]['rotation'][f],P[n]['scale'][f]);W[n]=(g(par[n])@L) if n in par else L;return W[n]
    for n in nm:g(n)
    return W
P1,_=pose(J1,B1,'walk_start_stepdown');PD,_=pose(JD,BD,'walk_start_stepdown')
bones=[n['name'] for n in JD['nodes'][:28]];rot={b:0 for b in bones};pos={b:0 for b in bones};toe={}
for f in range(53):
    W1=world(P1,J1,f);WD=world(PD,JD,f)
    for b in bones:
        rot[b]=max(rot[b],float(np.degrees(2*np.arccos(min(1,abs(np.dot(P1[b]['rotation'][f],PD[b]['rotation'][f])))))))
        pos[b]=max(pos[b],float(np.linalg.norm(W1[b][:3,3]-WD[b][:3,3])*1000))
    for b in ('foot.L','foot.R'):   # 脚尖代理点：骨头局部 +Y 0.12 m
        e=np.linalg.norm((W1[b]@[0,0.12,0,1]-WD[b]@[0,0.12,0,1])[:3])*1000;toe[b]=max(toe.get(b,0),float(e))
R['readback_30fps']=dict(frames=53,max_rot_err_deg=round(max(rot.values()),4),worst_bone=max(rot,key=rot.get),max_joint_pos_err_mm=round(max(pos.values()),3),worst_pos_bone=max(pos,key=pos.get),
  feet_pos_err_mm={b:round(pos[b],3) for b in ('foot.L','foot.R','shin.L','shin.R')},toe_proxy_err_mm={k:round(v,3) for k,v in toe.items()},skirt_pos_err_mm=round(max(pos[b] for b in bones if b.startswith('skirt')),3))
print(json.dumps(R,ensure_ascii=False,indent=1))
