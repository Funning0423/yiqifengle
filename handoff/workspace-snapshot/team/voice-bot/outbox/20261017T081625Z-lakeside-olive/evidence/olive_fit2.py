import sys,json;sys.path.insert(0,'.')
from olive_fit import *
H,W=G['oid'].shape
def regmask(reg,objs):
  x0,y0,x1,y1=regions.R[reg];m=np.zeros((H,W),bool);m[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]=True
  return m&np.isin(G['oid'],[G['ids'][o] for o in objs])
RM={'hills':regmask('far_trees',['LK_far_hills.glb']),'grass':regmask('grass_L',['LK_terrain.glb'])}
f={'hills':np.ones(3),'grass':np.ones(3)}
for it in range(4):
  img,nc=render(f)
  for g,(o,c,reg) in GROUPS.items():
    t=np.array(regions.med(ref,regions.R[reg]),float);m=np.median(img[RM[g]].astype(float),0)
    f[g]=np.clip(f[g]*(s2l(t)/np.maximum(s2l(m),1e-4))**0.9,0.1,20); print(it,g,m,'->',t,f[g].round(3))
img,nc=render(f);json.dump({'%s:%s'%k:list(map(int,v)) for k,v in nc.items()},open('olive_cells.json','w'))
print({'%s:%s'%k:'%02x%02x%02x'%tuple(v) for k,v in nc.items()})
for g in RM: print(g,'object-only median',np.median(img[RM[g]].astype(float),0))
Image.fromarray(img).save('emu_olive.png')
