# Blender headless: import 5c54f7a combined_visual_m.glb (+character), (1) lens-vs-geometry along the dumped outbound track,
# (2) render poses at given aspects. Cocos (x,y,z) -> Blender (x,-z,y). .blend never saved.
import bpy, json, sys, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
A=json.loads(open(sys.argv[sys.argv.index('--')+1]).read())
R='/workspace/wechat-game/yiqifengle/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=R+'creator-project/assets/firstslice/combined_visual_m.glb')
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=R+'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
chr_objs=[o for o in bpy.data.objects if o not in before]
roots=[o for o in chr_objs if o.parent is None]
def c2b(v): return Vector((v[0],-v[2],v[1]))
for r in roots: r.location=c2b(A['root']); r.rotation_mode='XYZ'
O=bpy.data.objects; S=bpy.context.scene
for o in O:
  if o.name.startswith('Icosphere'): o.hide_render=True
door=O['env_lighthouse_door']; door.rotation_mode='XYZ'; door0=door.rotation_euler.copy()
def setdoor(deg): door.rotation_euler=door0.copy(); door.rotation_euler.z+=math.radians(A.get('doorSign',1)*deg)
dg=bpy.context.evaluated_depsgraph_get()
def bvh(names):
  dg.update(); vs=[];fs=[]
  for n in names:
    o=O[n].evaluated_get(dg); m=o.to_mesh(); M=o.matrix_world; b=len(vs)
    vs+= [M@v.co for v in m.vertices]; fs+=[[b+i for i in p.vertices] for p in m.polygons]; o.to_mesh_clear()
  return BVHTree.FromPolygons(vs,fs)
res={}
if 'track' in A:
  T=json.load(open(A['track'])); F=[f for f in T['frames'] if f['phase']=='outbound' and f['t']<=A.get('tmax',1e9)]
  groups={'walls_ext':['env_lighthouse_ext'],'room_shell':['env_interior_shell'],'island_ground':['env_island_main'],
          'props':['env_island_props_merged','env_interior_props_merged','env_prop_palm_tall_01','env_prop_palm_lean_01','env_prop_palm_young_01']}
  setdoor(A['doorOpen']); trees={k:bvh(v) for k,v in groups.items()}; trees['door_leaf_open']=bvh(['env_lighthouse_door'])
  out=[];hits=[]
  for i,f in enumerate(F):
    p=c2b(f['position']); row={'t':f['t'],'pos':f['position']}
    for k,t in trees.items():
      n=t.find_nearest(p); row[k]=round(n[3],4) if n[0] else None
    if i:
      q=c2b(F[i-1]['position']); d=(p-q); L=d.length
      if L>1e-6:
        for k,t in trees.items():
          h=t.ray_cast(q,d.normalized(),L)
          if h[0]: hits.append({'t':f['t'],'group':k,'at':[h[0].x,h[0].z,-h[0].y]})
    out.append(row)
  mins={k:min((r for r in out if r[k] is not None),key=lambda r:r[k]) for k in trees}
  # lintel: frames where lens crosses door plane window |x|<1.2, cocos z in [-0.6,0.6]
  dw=[r for r in out if abs(r['pos'][0])<1.5 and -0.8<r['pos'][2]<0.8]
  res['collision']={'frames':len(out),'min_by_group':{k:{'d_m':v[k],'t':v['t'],'pos':v['pos']} for k,v in mins.items()},'segment_hits':hits,
    'doorway_frames':[{'t':r['t'],'pos':r['pos'],'d_walls_ext':r['walls_ext'],'d_room_shell':r['room_shell']} for r in dw]}
  json.dump(out,open(A['outdir']+'/lens_clearance_per_frame.json','w'))
# renders
S.render.engine=A.get('engine','BLENDER_EEVEE')
try: S.eevee.taa_render_samples=32
except: pass
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sun.data.energy=3.5; sun.rotation_euler=(math.radians(50),0,math.radians(30)); S.collection.objects.link(sun)
if not S.world: S.world=bpy.data.worlds.new('w')
S.world.color=(0.45,0.7,0.85)
S.view_settings.view_transform='Standard'
setdoor(A.get('doorRender',45))
cd=bpy.data.cameras.new('YJ'); cam=bpy.data.objects.new('YJ_CAM',cd); S.collection.objects.link(cam); S.camera=cam
cd.sensor_fit='VERTICAL'; cd.sensor_height=24.0; cd.clip_start=0.05; cd.clip_end=1500
ndc=[]
def bc(n):
  o=O[n]; cs=[o.matrix_world@Vector(c) for c in o.bound_box]; c=sum(cs,Vector())/8; return [c.x,c.z,-c.y]
for r in A['renders']:
  P=c2b(r['position']); Tg=c2b(r['target']); cd.lens=12.0/math.tan(math.radians(r['fov'])/2)
  cam.location=P; cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=(Tg-P).normalized().to_track_quat('-Z','Y')
  W,H=r['res']; S.render.resolution_x=W; S.render.resolution_y=H; S.render.resolution_percentage=100
  if 'doorSign' in r: A['doorSign']=r['doorSign']; setdoor(A.get('doorRender',45))
  S.render.filepath=r['out']; bpy.context.view_layer.update(); bpy.ops.render.render(write_still=True)
  # project points to NDC
  from bpy_extras.object_utils import world_to_camera_view as w2c
  def nd(c): v=w2c(S,cam,c2b(c)); return [round(2*v.x-1,3),round(2*v.y-1,3)]
  rt=A['root']; box=[[rt[0]+dx,rt[1]+dy,rt[2]+dz] for dx in(-.3,.3) for dz in(-.3,.3) for dy in(0,1.7253)]
  pb=[nd(c) for c in box]
  ndc.append({'out':r['out'],'girl_bbox_ndc':{'xmin':min(p[0] for p in pb),'xmax':max(p[0] for p in pb),'ymin':min(p[1] for p in pb),'ymax':max(p[1] for p in pb)},
    'points':{**{k:nd(v) for k,v in A['points'].items()},**{n+'_bbox_center':nd(bc(n)) for n in A['objpoints']}}})
res['renders']=ndc
json.dump(res,open(A['outdir']+'/island_check_result.json','w'),indent=1); print('DONE')
