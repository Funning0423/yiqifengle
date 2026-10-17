import bpy,sys,math,mathutils,json
from mathutils.bvhtree import BVHTree
argv=sys.argv[sys.argv.index('--')+1:];CHAR,CHAIR,TAG,WD=argv[:4]
sys.argv=['x','--',CHAR,CHAIR,'/tmp/_m','rig']
exec(open(WD+'/tools/render.py').read().split("arm=[o for o")[0])
arm=[o for o in chn if o.type=='ARMATURE'];stool=[o for o in stn if o.type=='MESH'][0]
res={}
for clip,fr in [('sit_hold',0.5),('sit_down',1.0),('stand_up',0.0)]:
  act=bpy.data.actions.get(clip)
  if not act: continue
  for a in arm: a.animation_data_create();a.animation_data.action=act
  r=act.frame_range;sc.frame_set(int(r[0]+(r[1]-r[0])*fr));dg=bpy.context.evaluated_depsgraph_get()
  sm=stool.evaluated_get(dg).to_mesh();SW=stool.matrix_world
  bvh=BVHTree.FromPolygons([SW@v.co for v in sm.vertices],[tuple(p.vertices) for p in sm.polygons])
  out={}
  for o in chn:
    if o.type!='MESH':continue
    m=o.evaluated_get(dg).to_mesh();M=o.matrix_world;cnt=0;deep=0.0;pts=[]
    for v in m.vertices:
      p=M@v.co;n=0;q=p.copy()
      for _ in range(20):
        hit=bvh.ray_cast(q,mathutils.Vector((0,0,1)))
        if hit[0] is None:break
        n+=1;q=hit[0]+mathutils.Vector((0,0,1e-5))
      if n%2==1:
        cnt+=1;d=bvh.find_nearest(p)[3];deep=max(deep,d);pts.append(p)
    out[o.name]=dict(vertsInsideStool=cnt,maxDepthMm=round(deep*1000,1))
  res[f'{clip}@{fr}']=out
print('INSIDE',TAG,json.dumps(res))
