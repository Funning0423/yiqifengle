"""Drop faces from env_skycity.glb primitives; every other primitive keeps its exact Draco bytes.
Changed primitives: unused vertices dropped, positions re-quantized on the ORIGINAL 14-bit lattice (same origin/range), UV 12 bit,
normals 10 bit octahedral, COLOR_0 bytes copied -> every kept vertex decodes to the same position / normal / UV / colour (checked).
python3 rewrite.py in.glb removals.npz out.glb      removals: {"<node>|<prim>": bool[faces] True=remove} (original decode order)"""
import sys,os,json,struct,numpy as np,DracoPy
sys.path.insert(0,os.path.dirname(__file__));import glbio
src,remf,dst=sys.argv[1:4];R=dict(np.load(remf))
j,bin_=glbio.load(src);views=[bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in j['bufferViews']];stats={}
def canon(P,N,UV,C,F):
    return np.array(sorted(tuple(np.round(np.array(sorted(tuple(np.r_[P[i],N[i]*0.1,UV[i],C[i]/255.0]) for i in f)),3).ravel()) for f in F))
for n in j['nodes']:
    if 'mesh' not in n:continue
    for pi,p in enumerate(j['meshes'][n['mesh']]['primitives']):
        k=f"{n['name']}|{pi}"
        if k not in R or not R[k].any():continue
        ext=p['extensions']['KHR_draco_mesh_compression'];d=DracoPy.decode(views[ext['bufferView']])
        rm=R[k];assert len(rm)==len(d.faces),k
        P0=d.points.astype('f8');mn=P0.min(0);rng=float((P0.max(0)-mn).max())
        faces=d.faces[~rm];used=np.unique(faces);remap=-np.ones(len(P0),np.int64);remap[used]=np.arange(len(used))
        P=P0[used];N=d.normals[used].astype('f8');UV=d.tex_coord[used].astype('f8');C=d.colors[used].astype('u1');nf=remap[faces].astype('u4')
        enc=DracoPy.encode(P,nf,quantization_bits=14,quantization_range=rng,quantization_origin=mn,compression_level=7,colors=C,tex_coord=UV,normals=N,
                           tex_coord_quantization_bits=12,normal_quantization_bits=10)
        e=DracoPy.decode(enc);Ae={a['attribute_type']:a['unique_id'] for a in e.attributes}
        # the encoder drops faces that are degenerate on the 14-bit lattice (zero area, never rasterised); allow exactly those
        area=lambda Q,G:0.5*np.linalg.norm(np.cross(Q[G[:,1]]-Q[G[:,0]],Q[G[:,2]]-Q[G[:,0]]),axis=1)
        keepnd=area(P,nf)>1e-7;ndrop=len(nf)-len(e.faces);assert ndrop<=int((~keepnd).sum()),(k,ndrop,int((~keepnd).sum()))
        eF=e.faces[area(e.points.astype('f8'),e.faces)>1e-7]
        assert len(eF)==int(keepnd.sum()),k
        a=canon(e.points,e.normals,e.tex_coord,e.colors.astype('f8'),eF);b_=canon(P,N,UV,C.astype('f8'),nf[keepnd])
        perr=float(np.abs(a-b_).max());uerr=perr;cerr=perr
        assert perr<=2e-3,(k,perr)
        nf=nf[:len(e.faces)] if ndrop else nf; nfaces=len(e.faces)
        views[ext['bufferView']]=enc
        ext['attributes']={'POSITION':Ae[0],'NORMAL':Ae[1],'COLOR_0':Ae[2],'TEXCOORD_0':Ae[3]}
        for a in p['attributes'].values():j['accessors'][a]['count']=int(len(e.points))
        j['accessors'][p['indices']]['count']=int(nfaces*3)
        pa=j['accessors'][p['attributes']['POSITION']];pa['min']=[float(x) for x in e.points.min(0)];pa['max']=[float(x) for x in e.points.max(0)]
        stats[k]={'faces':[int(len(d.faces)),int(nfaces)],'latticeDegenerateDropped':int(ndrop),'verts':[int(len(P0)),int(len(e.points))],'posErrM':float(perr),'uvErr':float(uerr),'colorErr':cerr,'bytes':[len(ext and views[ext['bufferView']]),0]}
out=bytearray()
for i,v in enumerate(views):
    while len(out)%4:out.append(0)
    j['bufferViews'][i]['byteOffset']=len(out);j['bufferViews'][i]['byteLength']=len(v);out+=v
while len(out)%4:out.append(0)
j['buffers'][0]['byteLength']=len(out)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
open(dst,'wb').write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+bytes(out))
print(json.dumps(stats));print('bytes',os.path.getsize(src),'->',os.path.getsize(dst))
