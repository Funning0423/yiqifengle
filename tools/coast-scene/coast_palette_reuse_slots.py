import os,sys
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
def need(k,doc):
  v=os.environ.get(k)
  if not v:sys.exit('set %s = %s'%(k,doc))
  return v
# QF_ISLAND_ART_GLB_DIR: island art glb folder (GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/assets/glb). QF_REUSE_WORK: scratch dir (dec/*.glb, outputs).
import sys,json,numpy as np,colorsys
from PIL import Image
sys.path.insert(0,HERE);W=need('QF_REUSE_WORK','scratch dir with dec/');os.chdir(W);import palette_uv as U
ISL=np.array(Image.open(os.path.join(ROOT,'art-src/board-ui/_deps/ui-props/textures/env_palette_256.png')).convert('RGB'))
CP=np.array(Image.open(need('QF_COAST_PALETTE_IN','coast palette BEFORE the reuse slots (git show fafaad1a:creator-build-project/assets/bundles/region_coast/textures/coast_palette.png)')).convert('RGB'))
CNT={'env_prop_grass_tuft_01':25,'env_prop_grass_tuft_02':19,'env_prop_flowers_01':16,'env_prop_hydrangea_bush_01':3}
cols=[];w=[]
for n,c in CNT.items():
  d,db=U.read_glb('dec/'+n+'.glb');p=d['meshes'][0]['primitives'][0];T=U.acc(d,db,p['attributes']['TEXCOORD_0']);I=U.acc(d,db,p['indices']).reshape(-1,3)
  for f in I:
    uv=T[f].mean(0);x=int(np.clip(uv[0]*256,0,255));y=int(np.clip(uv[1]*256,0,255))
    if y//16 in (0,11,12):cols.append(ISL[y,x]);w.append(c)
L=U.lab(np.array(cols,float));w=np.array(w,float)
cand=[c for c in U.candidates(CP) if c[0]!=13];CL=U.lab(np.array([c[2] for c in cand],float))
base=np.array([U.de00(np.broadcast_to(l,CL.shape),CL).min() for l in L]);print('before mean %.2f p95 %.2f'%(np.average(base,weights=w),np.percentile(base,95)))
rng=np.random.default_rng(1);best=None
for it in range(30):
  C=L[rng.choice(len(L),11,replace=False)]
  for _ in range(30):
    D=np.stack([U.de00(L,np.broadcast_to(c,L.shape)) for c in C],1);a=D.argmin(1)
    C=np.array([np.average(L[a==k],0,weights=w[a==k]) if (a==k).any() else C[k] for k in range(11)])
  D=np.minimum(np.stack([U.de00(L,np.broadcast_to(c,L.shape)) for c in C],1).min(1),base);sc=np.average(D,weights=w)
  if best is None or sc<best[0]:best=(sc,C)
def lab2rgb(Lb):
  L_,a,b=Lb;fy=(L_+16)/116;fx=fy+a/500;fz=fy-b/200;e=lambda t:t**3 if t**3>216/24389 else (116*t-16)/(24389/27)
  X=np.array([e(fx)*0.95047,e(fy) if L_>8 else L_/(24389/27),e(fz)*1.08883]);M=np.linalg.inv(np.array([[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]]))
  return np.clip(np.round(U.srgb(M@X)*255),0,255).astype(int)
NP=CP.copy();free=[(12,x) for x in range(212,256,4)];added=[]
for (b,x),c in zip(free,best[1]):
  rgb=lab2rgb(c);NP[16*b:16*b+16,x:x+4]=rgb;Lc=U.lab(np.array([rgb],float))[0];h,l,s=colorsys.rgb_to_hls(*(rgb/255))
  added.append(dict(band=b,x=[x,x+3],srgb='#%02x%02x%02x'%tuple(rgb),LCh=[round(Lc[0],1),round(float(np.hypot(Lc[1],Lc[2])),1)],HSL=[round(s,3),round(l,3)],source='k-means centroid of island env_palette_256 texels used by reuse props'))
Image.fromarray(NP).save('coast_palette_256.png',optimize=True)
cand2=[c for c in U.candidates(NP) if c[0]!=13];CL2=U.lab(np.array([c[2] for c in cand2],float))
after=np.array([U.de00(np.broadcast_to(l,CL2.shape),CL2).min() for l in L]);print('after mean %.2f p95 %.2f max %.2f'%(np.average(after,weights=w),np.percentile(after,95),after.max()))
json.dump(added,open('palette_added_r3.json','w'),indent=1);print(json.dumps(added))
