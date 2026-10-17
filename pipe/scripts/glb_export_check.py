"""Hard export check of our M1 GLB (pure python). usage: glb_export_check.py <in.glb> <report.json> [--snap <out.glb>]
--snap: node TRS within 1e-5 of identity scale / identity rotation is written as exactly 1 / omitted (float32 export noise), then the check reruns on the snapped file."""
import json,struct,sys,math,numpy as np
CT={5120:'i1',5121:'u1',5122:'i2',5123:'u2',5125:'u4',5126:'f4'}; NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    b=open(p,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; g=json.loads(b[20:20+n]); return b,g,20+n+8
def acc(b,g,off,i):
    a=g['accessors'][i]; nc=NC[a['type']]; out=np.zeros((a['count'],nc))
    if 'bufferView' in a:
        bv=g['bufferViews'][a['bufferView']]; dt=np.dtype(CT[a['componentType']]); st=bv.get('byteStride',0); o=off+bv.get('byteOffset',0)+a.get('byteOffset',0)
        if st and st!=dt.itemsize*nc:
            raw=np.frombuffer(b,dtype='u1',count=st*a['count'],offset=o).reshape(a['count'],st)[:,:dt.itemsize*nc].copy(); out=raw.view(dt).reshape(a['count'],nc).astype(float)
        else: out=np.frombuffer(b,dtype=dt,count=a['count']*nc,offset=o).reshape(-1,nc).astype(float)
        if a.get('normalized') and a['componentType'] in (5121,5123): out=out/{5121:255.,5123:65535.}[a['componentType']]
    return out
def snap(src,dst):
    b,g,off=load(src); ch=[]
    for nd in g['nodes']:
        if 'scale' in nd and max(abs(x-1) for x in nd['scale'])<1e-5 and nd['scale']!=[1,1,1]: ch.append((nd['name'],'scale',nd['scale'])); nd['scale']=[1,1,1]
        if 'rotation' in nd and max(abs(x) for x in nd['rotation'][:3])<1e-6 and nd['rotation']!=[0,0,0,1]: ch.append((nd['name'],'rotation',nd['rotation'])); nd.pop('rotation')
    js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
    n0=struct.unpack('<I',b[12:16])[0]; rest=b[20+n0:]
    out=b[:12]+struct.pack('<I',len(js))+b'JSON'+js+rest; out=out[:8]+struct.pack('<I',len(out))+out[12:]
    open(dst,'wb').write(out); return ch
def check(p):
    b,g,off=load(p); R={'file':p}; nodes=g['nodes']; par={c:i for i,nd in enumerate(nodes) for c in nd.get('children',[])}
    ai=[i for i,nd in enumerate(nodes) if nd.get('name')=='R5G2_RIG_22P4'][0]; chain=[]; i=ai
    while i is not None: chain.append({'node':nodes[i]['name'],'scale':nodes[i].get('scale',[1,1,1]),'scale_exactly_1':nodes[i].get('scale',[1,1,1])==[1,1,1]}); i=par.get(i)
    R['armature_and_parents']=chain
    js=set(j for s in g.get('skins',[]) for j in s['joints']); R['joint_rest_scale_max_dev']=max([max(abs(x-1) for x in nodes[j].get('scale',[1,1,1])) for j in js]+[0])
    R['joint_rest_scale_exactly_1']=all(nodes[j].get('scale',[1,1,1])==[1,1,1] for j in js)
    ibm=acc(b,g,off,g['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1); sc=np.linalg.norm(ibm[:,:3,:3],axis=1); R['ibm_scale_minmax']=[float(sc.min()),float(sc.max())]
    R['clips']=[a['name'] for a in g['animations']]; R['clip_count_is_4']=len(R['clips'])==4
    ri=[i for i,nd in enumerate(nodes) if nd.get('name')=='root'][0]; ff={}
    for an in g['animations']:
        t=r=None
        for c in an['channels']:
            if c['target'].get('node')==ri:
                v=acc(b,g,off,an['samplers'][c['sampler']]['output'])[0]
                if c['target']['path']=='translation': t=v
                if c['target']['path']=='rotation': r=v
        # glTF Y-up: yaw about Y from quaternion (x,y,z,w)
        x,y,z,w=r; yaw=math.degrees(math.atan2(2*(w*y+x*z),1-2*(y*y+x*x)))
        ff[an['name']]={'root_t_first_xz':[round(t[0],7),round(t[2],7)],'root_yaw_first_deg':round(yaw,6),'ok':abs(t[0])<1e-6 and abs(t[2])<1e-6 and abs(yaw)<1e-4}
    R['first_frame_root']=ff
    mesh_nodes={nd['mesh']:nd['name'] for nd in nodes if 'mesh' in nd}; W={}; M={}
    for mi,m in enumerate(g['meshes']):
        nm=mesh_nodes.get(mi,m.get('name')); mx=0; j1=False; nt=0
        for pr in m['primitives']:
            if 'JOINTS_1' in pr['attributes']: j1=True
            if 'WEIGHTS_0' in pr['attributes']: mx=max(mx,int((acc(b,g,off,pr['attributes']['WEIGHTS_0'])>0).sum(1).max()))
            nt=max(nt,len(pr.get('targets',[])))
        W[nm]={'max_nonzero_weights':mx,'JOINTS_1':j1}; M[nm]=nt
    R['weights']=W; R['max_weights_le_4']=all(v['max_nonzero_weights']<=4 and not v['JOINTS_1'] for v in W.values())
    R['morph_targets_per_mesh_node']=M; R['morphs_only_on_dress_apron']=set(k for k,v in M.items() if v)<= {'G2_DRESS_R5G2','G2_APRON_R5G2'} and all(M.get(k,0)>0 for k in ('G2_DRESS_R5G2','G2_APRON_R5G2'))
    # animation scale channels
    dev=0
    for an in g['animations']:
        for c in an['channels']:
            if c['target']['path']=='scale': dev=max(dev,float(np.abs(acc(b,g,off,an['samplers'][c['sampler']]['output'])-1).max()))
    R['anim_scale_channel_max_dev']=dev
    R['PASS']=all(c['scale_exactly_1'] for c in chain) and R['clip_count_is_4'] and all(v['ok'] for v in ff.values()) and R['max_weights_le_4'] and R['morphs_only_on_dress_apron']
    return R
a=sys.argv[1:]; rep={}
if '--snap' in a:
    rep['before']=check(a[0]); dst=a[a.index('--snap')+1]; rep['snapped']=snap(a[0],dst); rep['after']=check(dst)
else: rep['after']=check(a[0])
json.dump(rep,open(a[1],'w'),indent=1); print(json.dumps({k:(v['PASS'] if isinstance(v,dict) else len(v)) for k,v in rep.items()}))
