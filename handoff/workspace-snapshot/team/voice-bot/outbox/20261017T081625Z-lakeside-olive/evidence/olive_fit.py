import sys,json;sys.path.insert(0,'.')
from olive_base import *
s2l=lambda b:emu.s2l_true(np.asarray(b,float)/255)
HILLS={'4fa0a0','2f6446','3f7f52','5a93a8'}; GRASS={'6dbe45','a8d64a'}
GROUPS={'hills':(['LK_far_hills.glb'],HILLS,'far_trees'),'grass':(['LK_terrain.glb','LK_far_shore.glb'],GRASS,'grass_L')}
pb=palbyte(G);hexmap=np.array(['%02x%02x%02x'%tuple(c) for c in pb.reshape(-1,3)]).reshape(pb.shape[:2])
def masks(objs,cells):
  ids=[G['ids'][o] for o in objs if o in G['ids']];m=np.isin(G['oid'],ids)
  return {c:m&(hexmap==c) for c in cells}
MS={g:masks(o,c) for g,(o,c,_) in GROUPS.items()}
def newcells(f):
  out={}
  for g,(o,cells,_) in GROUPS.items():
    for c in cells:
      lin=s2l([int(c[i:i+2],16) for i in (0,2,4)])*f[g]; out[(g,c)]=np.round(emu.tex_byte(np.clip(lin,0,1))*255).astype(int)
  return out
def render(f,Gsrc=G):
  nc=newcells(f);G2=dict(Gsrc);alb=Gsrc['alb'].copy()
  for (g,c),b in nc.items(): alb[MS[g][c]]=s2l(b)
  G2['alb']=alb;return emu.shade(G2,P_now()),nc
if __name__=='__main__':
  ref_=ref;f={'hills':np.ones(3),'grass':np.ones(3)}
  for it in range(4):
    img,nc=render(f)
    for g,(o,c,reg) in GROUPS.items():
      t=np.array(regions.med(ref_,regions.R[reg]),float);m=np.array(regions.med(img,regions.R[reg]),float)
      f[g]=f[g]*(s2l(t)/np.maximum(s2l(m),1e-4))**0.9; print(it,g,m,'->',t,f[g].round(3))
  img,nc=render(f);json.dump({'%s:%s'%k:list(map(int,v)) for k,v in nc.items()},open('olive_cells.json','w'),indent=0)
  print({'%s:%s'%k:'%02x%02x%02x'%tuple(v) for k,v in nc.items()})
