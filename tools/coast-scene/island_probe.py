import trimesh,numpy as np,sys,json
sc=trimesh.load('/workspace/tmp-exp/wt-coast-scene/creator-project/assets/firstslice/combined_visual_m.glb')
M={}
for n in sc.graph.nodes_geometry:
  T,gn=sc.graph[n];m=sc.geometry[gn].copy();m.apply_transform(T);M[n]=m
def hgt(name,x,z):
  m=M[name];o=np.array([[x,50,z]]);d=np.array([[0,-1,0]])
  loc,_,_=m.ray.intersects_location(o,d)
  return loc[:,1].max() if len(loc) else None
if __name__=='__main__':
  for z in np.arange(4.0,14.01,0.5):
    row=[]
    for x in [-3.0,-2.56,-2.11,-1.66,-1.2]:
      a=hgt('env_island_main',x,z);b=hgt('env_island_props_merged',x,z)
      row.append(f"{x:+.2f}:{'-' if a is None else round(a,2)}/{'-' if b is None else round(b,2)}")
    print(f"z{z:5.1f}",'  '.join(row))
