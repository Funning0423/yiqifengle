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
import bmesh
act=bpy.data.actions.get('sit_hold')
for a in arm:a.animation_data.action=act
sc.frame_set(30);dg=bpy.context.evaluated_depsgraph_get()
sm=stool.evaluated_get(dg).to_mesh();SW=stool.matrix_world;sv=[SW@v.co for v in sm.vertices];top=max(v.z for v in sv);cx=sum(v.x for v in sv)/len(sv);cy=sum(v.y for v in sv)/len(sv)
bvh=BVHTree.FromPolygons(sv,[tuple(p.vertices) for p in sm.polygons])
mat=bpy.data.materials.new('red');mat.diffuse_color=(1,0,0,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,0,0,1);mat.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,0,0,1);mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=3
summ={}
for o in chn:
  if o.type!='MESH' or o.name not in('LOD0_G2_DRESS','LOD0_G2_BOW'):continue
  m=o.evaluated_get(dg).to_mesh();M=o.matrix_world;hs=[]
  for v in m.vertices:
    p=M@v.co;n=0;q=p.copy()
    for _ in range(20):
      h=bvh.ray_cast(q,mathutils.Vector((0,0,1)))
      if h[0] is None:break
      n+=1;q=h[0]+mathutils.Vector((0,0,1e-5))
    if n%2: hs.append(p)
  summ[o.name]=dict(n=len(hs),dzFromSeatTopMm=[round(min(p.z-top for p in hs)*1000),round(max(p.z-top for p in hs)*1000)],radialMm=[round(min(math.hypot(p.x-cx,p.y-cy) for p in hs)*1000),round(max(math.hypot(p.x-cx,p.y-cy) for p in hs)*1000)])
  for p in hs:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006,location=p,segments=8,ring_count=4);bpy.context.object.data.materials.append(mat)
print('WHERE',json.dumps(summ))
for o in chn:
  if o.type=='MESH' and o.name in ('LOD0_G2_DRESS','LOD0_G2_APRON'): o.hide_render=True
fwd=g2b((math.sin(yaw),0,math.cos(yaw)));right=fwd.cross(mathutils.Vector((0,0,1)));base=g2b(seatedRoot)
cam=bpy.data.objects.new('c2',bpy.data.cameras.new('c2'));sc.collection.objects.link(cam);sc.camera=cam;cam.data.lens=35
for nm,off in [('side',right*1.1+mathutils.Vector((0,0,.6))),('back',-fwd*1.1+right*.4+mathutils.Vector((0,0,.7)))]:
  cam.location=base+off;d=(base+mathutils.Vector((0,0,.4)))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
  sc.render.filepath=WD+'/stills/'+TAG+'_sit_hold_penetration_dress_hidden_'+nm+'.png';bpy.ops.render.render(write_still=True)

