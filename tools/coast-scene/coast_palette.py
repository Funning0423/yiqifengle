#!/usr/bin/env python3
"""Coast palette (场景设计部 2026-10-30, Grok Bot option B). Builds region_coast/textures/coast_palette.png from the island's frozen
env_palette_256.png (read-only): same 256x256 / 16 bands x 16 px / band 13 = the island emissive band, kept byte-identical so the island
M_env_palette's emissive texture still lines up. The least-used non-emissive, non-sand bands are rewritten as 64 coast swatches of 4 px
(texel centres x=4k+1, 4k+2 have identical neighbours). New colours = greedy cover of the coast face colours that the island pixels miss,
each clamped into the island palette's LCh L/C and HSL S/L ranges. Sand faces (terrain, L>=75, C<=25, h 85-115) are shifted by
(island beach sand mean - coast sand mean) in Lab and snapped ONLY to island sand texels the island main mesh uses.
Usage: coast_palette.py <env_palette_256.png> <combined_visual_m.glb> <coast glb dir> <out png> <out json>
"""
import sys,json,os,colorsys,numpy as np
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));import palette_uv as U
def island_sand(glb):
  j,bn=U.read_glb(glb);m=[x for x in j['meshes'] if x['name']=='env_island_main'][0];from collections import Counter;c=Counter()
  for p in m['primitives']:
    if p.get('material')!=0:continue
    uv=U.acc(j,bn,p['attributes']['TEXCOORD_0']);idx=U.acc(j,bn,p['indices']).reshape(-1,3).astype(int)
    for u,v in uv[idx].mean(1):
      r=int(v*16)
      if r in(1,3):c[(r,int(u*256))]+=1
  return c
def faces(d):
  out=[]
  for f in sorted(x for x in os.listdir(d) if x.endswith('.glb')):
    j,bn=U.read_glb(os.path.join(d,f))
    for m in j['meshes']:
      p=m['primitives'][0];col=U.acc(j,bn,p['attributes']['COLOR_0'])[:,:3];idx=U.acc(j,bn,p['indices']).reshape(-1,3).astype(int)
      vs=np.clip(np.round(U.srgb(col)*255),0,255);fs=np.clip(np.round(U.srgb(U.lin(vs[idx]/255).mean(1))*255),0,255);out.append((m['name'],fs))
  return out
TRANSLUCENT={'foam','foam_inner','contact','footprints','blob','net','crabtrap_mesh','tide_sheet','sidepool','beacon_line'}
SAND=dict(meshes=['terrain'],L_min=75,C_max=25,h=(85,115))
def is_sand(name,fs):
  if name not in SAND['meshes']:return np.zeros(len(fs),bool)
  L=U.lab(fs);h=np.degrees(np.arctan2(L[:,2],L[:,1]))%360;c=np.hypot(L[:,1],L[:,2]);return (L[:,0]>=SAND['L_min'])&(c<=SAND['C_max'])&(h>=SAND['h'][0])&(h<=SAND['h'][1])
def hsl(rgb):h,l,s=colorsys.rgb_to_hls(*(np.asarray(rgb)/255));return h*360,s,l
def lch(rgb):L=U.lab(np.array([rgb],float))[0];return L[0],float(np.hypot(L[1],L[2])),float(np.degrees(np.arctan2(L[2],L[1]))%360)
def clamp(rgb,R):
  """pull chroma/lightness into the island range in Lab (hue kept), then verify HSL; shrink chroma until HSL S/L also inside."""
  L=U.lab(np.array([rgb],float))[0];C=np.hypot(L[1],L[2]);h=np.arctan2(L[2],L[1])
  Lc=min(max(L[0],R['L'][0]),R['L'][1]);Cc=min(max(C,R['C'][0]),R['C'][1])
  for _ in range(200):
    rgb2=lab2rgb([Lc,Cc*np.cos(h),Cc*np.sin(h)]);_,s,l=hsl(rgb2);L2,C2,_h=lch(rgb2)
    if R['S'][0]<=s<=R['S'][1] and R['HL'][0]<=l<=R['HL'][1] and R['L'][0]<=L2<=R['L'][1] and R['C'][0]<=C2<=R['C'][1]:return rgb2
    if l>R['HL'][1] or L2>R['L'][1]:Lc-=0.3
    elif l<R['HL'][0] or L2<R['L'][0]:Lc+=0.3
    elif C2<R['C'][0] or s<R['S'][0]:Cc=max(Cc,R['C'][0])+0.3
    else:Cc*=0.97
  return rgb2
def lab2rgb(L):
  fy=(L[0]+16)/116;fx=fy+L[1]/500;fz=fy-L[2]/200;f=np.array([fx,fy,fz]);x=np.where(f**3>216/24389,f**3,(116*f-16)/(24389/27))*np.array([0.95047,1,1.08883])
  M=np.linalg.inv(np.array([[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]]));l=np.clip(M@x,0,1)
  return tuple(int(v) for v in np.clip(np.round(U.srgb(l)*255),0,255))
def main(pal,isl,gdir,outpng,outjson,nb=None):
  P=np.array(Image.open(pal).convert('RGB')).astype(int);sand=island_sand(isl)
  px=np.concatenate([P[16*r:16*r+16] for r in range(16) if r!=13]).reshape(-1,3);Lp=U.lab(px);Cp=np.hypot(Lp[:,1],Lp[:,2]);H=np.array([colorsys.rgb_to_hls(*(c/255)) for c in np.unique(px,axis=0)])
  R={'L':(float(Lp[:,0].min()),float(Lp[:,0].max())),'C':(float(Cp.min()),float(Cp.max())),'S':(float(H[:,2].min()),float(H[:,2].max())),'HL':(float(H[:,1].min()),float(H[:,1].max()))}
  F=faces(gdir);names=[];cols=[];
  for n,fs in F:
    s=is_sand(n,fs);names+= [n]*int((~s).sum());cols.append(fs[~s])
  cols=np.concatenate(cols);U_,inv,w=np.unique(cols,axis=0,return_inverse=True,return_counts=True);inv=inv.reshape(-1);LU=U.lab(U_)
  C=U.candidates(P);band=np.array([c[0] for c in C]);CL=U.lab(np.array([c[2] for c in C]))
  emitm=np.array([n in U.EMIT for n in names])
  d0=np.full(len(U_),1e9);pick=np.zeros(len(U_),int)
  for k in range(0,len(U_),256):d=U.de00(LU[k:k+256,None],CL[None,band!=13]);d0[k:k+256]=d.min(1);pick[k:k+256]=np.flatnonzero(band!=13)[d.argmin(1)]
  use=np.bincount(band[pick],weights=w,minlength=16);order=[r for r in np.argsort(use) if r not in(1,3,13)]
  res=None
  for N in ([nb] if nb else [1,2,3,4]):
    free=sorted(int(r) for r in order[:N]);keep=~np.isin(band,free+[13]);cur=np.full(len(U_),1e9)
    for k in range(0,len(U_),256):cur[k:k+256]=U.de00(LU[k:k+256,None],CL[None,keep]).min(1)
    cand=[clamp(tuple(int(v) for v in c),R) for c in U_];LC=U.lab(np.array(cand,float))
    D=np.vstack([U.de00(LU[k:k+256,None],LC[None]) for k in range(0,len(U_),256)])
    chosen=[]
    for it in range(64*N-24):   # phase 1: global cover
      gain=(w[:,None]*np.maximum(0,cur[:,None]-D)).sum(0);j=int(gain.argmax())
      if gain[j]<=0:break
      chosen.append(j);cur=np.minimum(cur,D[:,j])
    nm=np.array(names);meshes=sorted(set(names))
    def failing():
      fe=cur[inv];out=[]
      for m in meshes:
        if m in TRANSLUCENT:continue   # GGbot's island material via resolveMaterial; reported, not repaired
        e=fe[nm==m];mm,p9=e.mean(),np.percentile(e,95)
        if mm>2 or p9>5:out.append((round(float(max(mm-2,p9-5)),2),m))
      return sorted(out,reverse=True)
    tried=set()
    while len(chosen)<64*N:   # phase 2: per-mesh repair (mean<=2, p95<=5 per mesh)
      fl=[f for f in failing() if f[1] not in tried]
      if not fl:break
      m=fl[0][1];sel=np.bincount(inv[nm==m],minlength=len(U_)).astype(float)
      gain=(sel[:,None]*np.maximum(0,cur[:,None]-D)).sum(0);j=int(gain.argmax())
      if gain[j]<=1e-6:tried.add(m);continue
      chosen.append(j);cur=np.minimum(cur,D[:,j])
    fe=cur[inv];res=(N,free,chosen,float(fe.mean()),float(np.percentile(fe,95)))
    print('N',N,'free',free,'added',len(chosen),'nonsand mean %.2f p95 %.2f'%(res[3],res[4]),'failing',failing())
    if not failing():break
  N,free,chosen,_,_=res;Q=P.copy().astype(np.uint8);added=[]
  slots=[(r,k) for r in free for k in range(64)]
  for (r,k),j in zip(slots,chosen):
    c=cand[j];Q[16*r:16*r+16,4*k:4*k+4]=c;L_,C_,h_=lch(c);hh,s,l=hsl(c);src=tuple(int(v) for v in U_[j])
    added.append({'band':r,'x':[4*k,4*k+3],'uv_centre_x':4*k+1,'srgb':'#%02x%02x%02x'%c,'from_face_srgb':'#%02x%02x%02x'%src,'clamped':c!=src,'LCh':[round(L_,1),round(C_,1),round(h_,1)],'HSL':[round(hh,1),round(s,3),round(l,3)],'faces':int(w[j])})
  for r in free:   # unused swatches of a rewritten band: island pixels of the same band (no new colours)
    pass
  Image.fromarray(Q).save(outpng,optimize=True)
  json.dump({'island_range':{'LCh_L':R['L'],'LCh_C':R['C'],'HSL_S':R['S'],'HSL_L':R['HL']},'rewritten_bands':free,'band_usage_before':use.round().tolist(),'added':added,
    'sand':{'island_texels':[[r,x,n] for (r,x),n in sand.most_common()],**SAND}},open(outjson,'w'),indent=1)
  return free,sand
def bake(pal,isl,gdir,outpng,outjson,glbout,stats):
  free,sand=main(pal,isl,gdir,outpng,outjson)
  P=np.array(Image.open(pal).convert('RGB')).astype(int);tex=[k for k,_ in sand.items()];wt=np.array([sand[k] for k in tex],float)
  Li=(U.lab(np.array([P[16*r+8,x] for r,x in tex],float))*wt[:,None]).sum(0)/wt.sum()
  cs=np.concatenate([fs[is_sand(n,fs)] for n,fs in faces(gdir)]);Lc=U.lab(cs).mean(0)
  rules={'sand':{**SAND,'texels':tex,'shift_lab':(Li-Lc).tolist()}}
  S=U.main(outpng,gdir,glbout,stats,5.0,rules)
  S['sand_fix']={'island_sand_mean_lab':Li.round(2).tolist(),'coast_sand_mean_lab_before':Lc.round(2).tolist(),'shift_lab':(Li-Lc).round(2).tolist(),
    'island_sand_mean_srgb':lab2rgb(Li),'coast_sand_mean_srgb_before':lab2rgb(Lc),'dE00_coast_vs_island_sand_before':round(float(U.de00(Lc,Li)),2)}
  json.dump(S,open(stats,'w'),indent=1,ensure_ascii=False);return S
if __name__=='__main__':
  a=sys.argv[1:]
  if len(a)>=7:S=bake(*a[:7]);print(json.dumps(S['overall']),json.dumps(S['sand_fix']),json.dumps(S['files']))
  else:main(*a[:5])
