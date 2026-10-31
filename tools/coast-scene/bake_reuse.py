import os,sys
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
def need(k,doc):
  v=os.environ.get(k)
  if not v:sys.exit('set %s = %s'%(k,doc))
  return v
# QF_ISLAND_ART_GLB_DIR: island art glb folder (GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/assets/glb). QF_REUSE_WORK: scratch dir (dec/*.glb, outputs).
import sys,json,struct,io,os,numpy as np
from PIL import Image
sys.path.insert(0,HERE);import palette_uv as U
ART=os.path.join(need('QF_ISLAND_ART_GLB_DIR','island art glb dir'),'');W=need('QF_REUSE_WORK','scratch dir with dec/ (bake_reuse_decimate.py) and coast_palette_256.png (coast_palette_reuse_slots.py)');os.chdir(W)
CP=np.array(Image.open('coast_palette_256.png').convert('RGB'));ISL=np.array(Image.open(os.path.join(ROOT,'art-src/board-ui/_deps/ui-props/textures/env_palette_256.png')).convert('RGB'))
j,bn=U.read_glb(ART+'env_prop_rock_01.glb');ims=[]
for im in j['images']:
  bv=j['bufferViews'][im['bufferView']];ims.append(np.array(Image.open(io.BytesIO(bn[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB')))
mi=j['materials'][0];bt=mi['pbrMetallicRoughness']['baseColorTexture']['index'];IP=ims[j['textures'][bt]['source']]
print('island img',IP.shape,'emissive tex?','emissiveTexture' in mi,'pbr',{k:v for k,v in mi['pbrMetallicRoughness'].items() if k!='baseColorTexture'})
REW={0,11,12};same=[r for r in range(16) if r not in REW and (IP[16*r:16*r+16]==CP[16*r:16*r+16]).all()];print('identical non-rewritten bands',len(same),'/13')
cand=[(c[0],c[1]) for c in U.candidates(CP) if c[0]!=13];CL=U.lab(np.array([CP[16*r+8,x] for r,x in cand],float))
names=json.load(open('dec/tris.json'));out={};nodes=[];meshes=[];acc=[];bvs=[];blob=bytearray();stats={}
def add(arr,tgt=None):
  arr=np.ascontiguousarray(arr);o=len(blob);blob.extend(arr.tobytes());blob.extend(b'\0'*((-len(blob))%4));bvs.append(dict(buffer=0,byteOffset=o,byteLength=arr.nbytes,**({'target':tgt} if tgt else {})));return len(bvs)-1
for n in names:
  d,db=U.read_glb('dec/'+n+'.glb');p=d['meshes'][0]['primitives'];assert len(p)==1;p=p[0]
  P=U.acc(d,db,p['attributes']['POSITION']).astype('f4');N=U.acc(d,db,p['attributes']['NORMAL']).astype('f4');T=U.acc(d,db,p['attributes']['TEXCOORD_0']).astype('f4').copy();I=U.acc(d,db,p['indices']).reshape(-1,3)
  F=[];kept=rem=0;des=[]
  for f in I:
    uv=T[f].mean(0);x=int(np.clip(uv[0]*256,0,255));y=int(np.clip(uv[1]*256,0,255));r=y//16
    if r not in REW:F.append([(P[k],N[k],T[k]) for k in f]);kept+=1;continue
    c=U.lab(np.array([ISL[y,x]],float))[0];de=U.de00(np.broadcast_to(c,CL.shape),CL);k=int(np.argmin(de));rr,xx=cand[k];des.append(float(de[k]));rem+=1
    tu=np.array([(xx+0.5)/256,(16*rr+8)/256],'f4');F.append([(P[q],N[q],tu) for q in f])
  # dedup
  key={};V=[];idx=[]
  for f in F:
    for pos,nor,t in f:
      kk=(tuple(np.round(pos,5)),tuple(np.round(nor,3)),tuple(np.round(t,6)))
      if kk not in key:key[kk]=len(V);V.append((pos,nor,t))
      idx.append(key[kk])
  Pp=np.array([v[0] for v in V],'f4');Nn=np.array([v[1] for v in V],'f4');Tt=np.array([v[2] for v in V],'f4');Ii=np.array(idx,'u2')
  a0=len(acc);acc+= [dict(bufferView=add(Pp,34962),componentType=5126,count=len(Pp),type='VEC3',min=Pp.min(0).tolist(),max=Pp.max(0).tolist()),
    dict(bufferView=add(Nn,34962),componentType=5126,count=len(Pp),type='VEC3'),dict(bufferView=add(Tt,34962),componentType=5126,count=len(Pp),type='VEC2'),
    dict(bufferView=add(Ii,34963),componentType=5123,count=len(Ii),type='SCALAR')]
  meshes.append(dict(name=n,primitives=[dict(attributes=dict(POSITION=a0,NORMAL=a0+1,TEXCOORD_0=a0+2),indices=a0+3)]));nodes.append(dict(name=n,mesh=len(meshes)-1))
  hz=float(max(np.abs(Pp[:,0]).max(),np.abs(Pp[:,2]).max()));y0=float(Pp[:,1].min());s=1/hz
  stats[n]=dict(tris_src=names[n][0],tris=len(Ii)//3,verts=len(Pp),faces_kept_uv=kept,faces_remapped=rem,de00_mean=float(np.mean(des)) if des else 0,de00_p95=float(np.percentile(des,95)) if des else 0,de00_max=float(max(des)) if des else 0,
    raw_bytes=Pp.nbytes+Nn.nbytes+Tt.nbytes+Ii.nbytes,norm=dict(scale=round(s,5),offsetY=round(-y0*s-0.1,5)))
mat=dict(name='M_env_palette',pbrMetallicRoughness=dict(baseColorFactor=[1,1,1,1],metallicFactor=0,roughnessFactor=0.9))
g=dict(asset=dict(version='2.0',generator='coast reuse bake (场景设计部)'),scene=0,scenes=[dict(nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,accessors=acc,bufferViews=bvs,buffers=[dict(byteLength=len(blob))])
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
open('coast_reuse.glb','wb').write(glb)
alld=[];print(json.dumps(stats,indent=0,ensure_ascii=False));print('glb',len(glb))
json.dump(stats,open('reuse_stats.json','w'),indent=1)
