#!/usr/bin/env python3
"""Coast palette-UV bake (场景设计部 2026-10-30). Post-step of build_coast.py: rewrites each coast GLB so it renders with the
island's M_env_palette (env_palette_256.png, frozen, read-only here):
 - per FACE: mean of its corner vertex colours (linear COLOR_0 -> sRGB) snapped by CIEDE2000 to an EXISTING palette texel;
   every corner of the face gets that texel's centre UV ((x+.5)/256, (r+.5)/16) -> flat palette colour, no cross-texel interpolation.
 - candidates: the 16 bands (row r centre, same v convention as the island: v=(r+0.5)/16, glTF v down), columns whose left/right
   neighbours are within dE00<=2 (no swatch edges under bilinear/mip filtering). Band 13 (non-black env_palette_emissive_256) is
   allowed only for emissive coast meshes (EMIT); all other meshes never land on a glowing texel.
 - COLOR_0 dropped (M_env_palette ignores it); vertices de-duplicated on (position, normal, uv); UV float32 (Creator meshCompress
   quantize re-quantizes on import).
 - writes <stats.json>: per-vertex dE00 / RGB distance vertex colour -> its face's snapped colour, per mesh and overall, over-threshold list.
Usage: palette_uv.py <palette.png> <in_dir> <out_dir> <stats.json> [threshold=5]
"""
import json,struct,sys,os,numpy as np
from PIL import Image
EMIT={'beacon_lamp','seaglass','beacon_line','anemone'}
def srgb(l):l=np.clip(l,0,1);return np.where(l<=0.0031308,12.92*l,1.055*np.power(l,1/2.4)-0.055)
def lin(s):return np.where(s<=0.04045,s/12.92,np.power((s+0.055)/1.055,2.4))
def lab(rgb8):
  l=lin(np.asarray(rgb8,float)/255);M=np.array([[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]])
  x=l@M.T/np.array([0.95047,1.0,1.08883]);f=np.where(x>216/24389,np.cbrt(x),(24389/27*x+16)/116)
  return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
def de00(a,b):
  L1,a1,b1=a[...,0],a[...,1],a[...,2];L2,a2,b2=b[...,0],b[...,1],b[...,2]
  C1=np.hypot(a1,b1);C2=np.hypot(a2,b2);Cm=(C1+C2)/2;G=0.5*(1-np.sqrt(Cm**7/(Cm**7+25**7)))
  a1p=(1+G)*a1;a2p=(1+G)*a2;C1p=np.hypot(a1p,b1);C2p=np.hypot(a2p,b2)
  h1=np.degrees(np.arctan2(b1,a1p))%360;h2=np.degrees(np.arctan2(b2,a2p))%360
  dL=L2-L1;dC=C2p-C1p;dh=h2-h1;dh=np.where(dh>180,dh-360,np.where(dh<-180,dh+360,dh));dh=np.where(C1p*C2p==0,0,dh)
  dH=2*np.sqrt(C1p*C2p)*np.sin(np.radians(dh/2));Lm=(L1+L2)/2;Cmp=(C1p+C2p)/2
  hs=h1+h2;hm=np.where(C1p*C2p==0,hs,np.where(np.abs(h1-h2)<=180,hs/2,np.where(hs<360,(hs+360)/2,(hs-360)/2)))
  T=1-0.17*np.cos(np.radians(hm-30))+0.24*np.cos(np.radians(2*hm))+0.32*np.cos(np.radians(3*hm+6))-0.20*np.cos(np.radians(4*hm-63))
  Sl=1+0.015*(Lm-50)**2/np.sqrt(20+(Lm-50)**2);Sc=1+0.045*Cmp;Sh=1+0.015*Cmp*T
  Rt=-2*np.sqrt(Cmp**7/(Cmp**7+25**7))*np.sin(np.radians(60*np.exp(-((hm-275)/25)**2)))
  return np.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh))
def candidates(P):
  out=[]
  for r in range(16):
    row=P[16*r+8];L=lab(row)
    for x in range(256):
      ok=all(de00(L[x],L[n])<=2 for n in (x-1,x+1) if 0<=n<256)
      if ok:out.append((r,x,tuple(int(c) for c in row[x])))
  return out
def read_glb(p):
  b=open(p,'rb').read();jl=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+jl]);bn=b[20+jl+8:];return j,bn
def acc(j,bn,i):
  a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']];st=bv.get('byteStride')
  off=bv.get('byteOffset',0)+a.get('byteOffset',0);isz=np.dtype(dt).itemsize
  if st and st!=n*isz:raw=np.frombuffer(bn,dtype='u1',count=st*a['count'],offset=off).reshape(-1,st)[:,:n*isz].copy();arr=raw.view(dt).reshape(-1,n)
  else:arr=np.frombuffer(bn,dtype=dt,count=a['count']*n,offset=off).reshape(-1,n)
  if a.get('normalized'):arr=arr/float({5123:65535,5121:255}[a['componentType']])
  return arr
def main(pal,ind,outd,statp,thr=5.0,rules=None):
  rules=rules or {}
  P=np.array(Image.open(pal).convert('RGB')).astype(int);C=candidates(P);CX=np.array([c[1] for c in C]);CL=lab(np.array([c[2] for c in C]));band=np.array([c[0] for c in C])
  os.makedirs(outd,exist_ok=True);S={'threshold_dE00':thr,'palette':os.path.basename(pal),'candidates':len(C),'meshes':{},'over':[],'files':{}}
  allde=[];allrgb=[];allf=[];allflat=[];allf_ns=[]
  for f in sorted(x for x in os.listdir(ind) if x.endswith('.glb')):
    j,bn=read_glb(os.path.join(ind,f));blob=bytearray();views=[];accs=[]
    def put(arr,target,ctype,typ,mm=False):
      while len(blob)%4:blob.append(0)
      o=len(blob);blob.extend(arr.tobytes());views.append({'buffer':0,'byteOffset':o,'byteLength':arr.nbytes,**({'target':target} if target else {})})
      a={'bufferView':len(views)-1,'componentType':ctype,'count':int(arr.shape[0]),'type':typ}
      if mm:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
      accs.append(a);return len(accs)-1
    meshes=[]
    for m in j['meshes']:
      prims=[]
      for p in m['primitives']:
        pos=acc(j,bn,p['attributes']['POSITION']).astype('<f4');nor=acc(j,bn,p['attributes']['NORMAL']).astype('<f4')
        col=acc(j,bn,p['attributes']['COLOR_0'])[:,:3];idx=acc(j,bn,p['indices']).reshape(-1).astype(np.int64);tri=idx.reshape(-1,3)
        vs=np.clip(np.round(srgb(col)*255),0,255)          # vertex colour as sRGB 8-bit (what the preview showed)
        fl=lin(vs[tri]/255).mean(1);fs=np.clip(np.round(srgb(fl)*255),0,255)   # face mean (linear average)
        allow=np.ones(len(C),bool) if m['name'] in EMIT else band!=13
        orig_fs=fs.copy();sandf=np.zeros(len(fs),bool)
        sd=rules.get('sand')
        if sd and m['name'] in sd['meshes']:
          Lf=lab(fs);h=np.degrees(np.arctan2(Lf[:,2],Lf[:,1]))%360;ch=np.hypot(Lf[:,1],Lf[:,2])
          sandf=(Lf[:,0]>=sd['L_min'])&(ch<=sd['C_max'])&(h>=sd['h'][0])&(h<=sd['h'][1])
        sandmask=np.zeros(len(C),bool)
        if sd:
          for (r,x) in sd['texels']:sandmask|=(band==r)&(CX==x)
        fc=np.empty(len(fs),int)
        for grp,am,shift in ((~sandf,allow,None),(sandf,allow&sandmask,sd and sd.get('shift_lab'))):
          if not grp.any():continue
          ul,inv=np.unique(fs[grp],axis=0,return_inverse=True);inv=inv.reshape(-1);Lu=lab(ul)
          if shift is not None:Lu=Lu+np.array(shift)
          pick=np.empty(len(ul),int);ix=np.flatnonzero(am)
          for k in range(0,len(ul),256):d=de00(Lu[k:k+256,None,:],CL[None,am,:]);pick[k:k+256]=ix[d.argmin(1)]
          fc[grp]=pick[inv]
        uv=np.array([[(C[c][1]+0.5)/256,(C[c][0]+0.5)/16] for c in fc],'<f4')
        snapped=np.array([C[c][2] for c in fc],float)
        dv=de00(lab(vs[tri].reshape(-1,3)),lab(np.repeat(snapped,3,0)));drgb=np.linalg.norm(vs[tri].reshape(-1,3)-np.repeat(snapped,3,0),axis=1)
        dfc=de00(lab(fs),lab(snapped));nsand=~sandf;dfc_ns=dfc[nsand] if nsand.any() else np.zeros(1);allf_ns.append(dfc_ns);
        if sandf.any():S.setdefault('sand',{})[m['name']]={'faces':int(sandf.sum()),'coast_mean_srgb':np.round(fs[sandf].mean(0)).tolist(),'snapped_mean_srgb':np.round(snapped[sandf].mean(0)).tolist(),'dE00_mean':round(float(dfc[sandf].mean()),2),'dE00_max':round(float(dfc[sandf].max()),2)}
        dflat=de00(lab(vs[tri].reshape(-1,3)),lab(np.repeat(fs,3,0)));allf.append(dfc);allflat.append(dflat)
        allde.append(dv);allrgb.append(drgb)
        S['meshes'][m['name']]={'file':f,'faces':int(len(tri)),'dE00_max':round(float(dv.max()),2),'dE00_mean':round(float(dv.mean()),2),
          'rgb_max':round(float(drgb.max()),1),'rgb_mean':round(float(drgb.mean()),1),'face_snap_dE00_max':round(float(dfc.max()),2),'face_snap_dE00_mean':round(float(dfc.mean()),2),'face_snap_dE00_p95':round(float(np.percentile(dfc,95)),2),'nonsand_face_dE00_mean':round(float(dfc_ns.mean()),2),'nonsand_face_dE00_p95':round(float(np.percentile(dfc_ns,95)),2),'nonsand_face_dE00_max':round(float(dfc_ns.max()),2),'sand_faces':int(sandf.sum()),'flatten_dE00_mean':round(float(dflat.mean()),2),'texels':int(len(set(fc.tolist()))),'over_vertices':int((dv>thr).sum()),'emissive_band_allowed':m['name'] in EMIT}
        for c in np.unique(np.flatnonzero(dv>thr)//3):pass
        for k in np.flatnonzero(dfc>thr):
          S.setdefault('face_over',{}).setdefault((m['name'],tuple(int(x) for x in fs[k]),tuple(int(x) for x in snapped[k]),bool(sandf[k])),[0,float(dfc[k])])[0]+=1
        # over-threshold: grouped by (vertex colour -> snapped colour)
        ov={}
        for k in np.flatnonzero(dv>thr):
          key=(tuple(int(x) for x in vs[tri].reshape(-1,3)[k]),tuple(int(x) for x in snapped[k//3]));e=ov.setdefault(key,[0,float(dv[k]),float(drgb[k])]);e[0]+=1
        for (a,b),(n,d,r) in sorted(ov.items(),key=lambda x:-x[1][1]):S['over'].append({'mesh':m['name'],'vertex_srgb':list(a),'snapped_srgb':list(b),'vertices':n,'dE00':round(d,2),'rgb':round(r,1)})
        # new vertex stream: corners -> (pos,nor,uv), dedup
        cp=pos[idx];cn=nor[idx];cu=np.repeat(uv,3,0);key=np.concatenate([cp,cn,cu],1).astype('<f4')
        uk,ninv=np.unique(key.view(np.dtype((np.void,key.dtype.itemsize*key.shape[1]))).reshape(-1),return_inverse=True)
        first=np.zeros(len(uk),np.int64);first[ninv[::-1]]=np.arange(len(ninv))[::-1];V=key[first];ninv=ninv.reshape(-1)
        it=(np.uint16 if len(V)<65536 else np.uint32);ct=5123 if it==np.uint16 else 5125
        a_p=put(np.ascontiguousarray(V[:,0:3]),34962,5126,'VEC3',True);a_n=put(np.ascontiguousarray(V[:,3:6]),34962,5126,'VEC3');a_u=put(np.ascontiguousarray(V[:,6:8]),34962,5126,'VEC2')
        a_i=put(ninv.astype('<'+np.dtype(it).str[1:]),34963,ct,'SCALAR')
        prims.append({'attributes':{'POSITION':a_p,'NORMAL':a_n,'TEXCOORD_0':a_u},'indices':a_i,'mode':4})
        S['meshes'][m['name']].update(vertices_before=int(len(pos)),vertices_after=int(len(V)))
      meshes.append({'name':m['name'],'primitives':prims})
    while len(blob)%4:blob.append(0)
    nj={'asset':{'version':'2.0','generator':'qf palette_uv.py'},'scene':0,'scenes':j['scenes'],'nodes':j['nodes'],'meshes':meshes,'accessors':accs,'bufferViews':views,'buffers':[{'byteLength':len(blob)}]}
    js=json.dumps(nj,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
    out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
    open(os.path.join(outd,f),'wb').write(out);S['files'][f]={'before':os.path.getsize(os.path.join(ind,f)),'after':len(out)}
  d=np.concatenate(allde);r=np.concatenate(allrgb)
  S['overall']={'vertices':int(len(d)),'dE00_max':round(float(d.max()),2),'dE00_mean':round(float(d.mean()),2),'dE00_p95':round(float(np.percentile(d,95)),2),'rgb_max':round(float(r.max()),1),'rgb_mean':round(float(r.mean()),1),'over_vertices':int((d>thr).sum()),'face_snap_dE00_max':round(float(np.concatenate(allf).max()),2),'face_snap_dE00_mean':round(float(np.concatenate(allf).mean()),2),'nonsand_face_dE00_mean':round(float(np.concatenate(allf_ns).mean()),2),'nonsand_face_dE00_p95':round(float(np.percentile(np.concatenate(allf_ns),95)),2),'face_snap_dE00_p95':round(float(np.percentile(np.concatenate(allf),95)),2),'flatten_only_dE00_mean':round(float(np.concatenate(allflat).mean()),2)}
  S['face_over']=[{'mesh':a,'face_srgb':list(b),'snapped_srgb':list(c),'sand_fix':sf,'faces':n,'dE00':round(d,2)} for (a,b,c,sf),(n,d) in sorted(S.get('face_over',{}).items(),key=lambda x:-x[1][1])]
  json.dump(S,open(statp,'w'),indent=1,ensure_ascii=False);return S
if __name__=='__main__':
  a=sys.argv[1:];S=main(a[0],a[1],a[2],a[3],float(a[4]) if len(a)>4 else 5.0);print(json.dumps(S['overall']),json.dumps(S['files']))
