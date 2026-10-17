# Still render + checks for candidate end poses. args: json {poses:[{name,pos,target,fov}],res,samples,out}
import bpy,json,sys,math
from mathutils import Vector
A=json.loads(open(sys.argv[sys.argv.index('--')+1]).read());J=json.load(open('/tmp/b5/job_B5_075.json'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/wechat-game/yiqifengle/creator-project/assets/firstslice/combined_visual_m.glb')
env=set(bpy.data.objects);propobjs=set()
for p in J['props']:
  b=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p['glb']);new=[o for o in bpy.data.objects if o not in b];propobjs|=set(new)
  for o in [o for o in new if o.parent is None]:
    o.location=(p['position'][0],-p['position'][2],p['position'][1]);o.rotation_mode='XYZ';o.rotation_euler.z+=math.radians(p['yawDeg']);o.scale=[s*p['scale'] for s in o.scale]
b=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath='/tmp/wt-b5/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
chr_=[o for o in bpy.data.objects if o not in b];roots=[o for o in chr_ if o.parent is None]

_pal=bpy.data.materials.get('M_env_palette')
for _o in bpy.data.objects:
  if _o.type=='MESH':
    for _s in _o.material_slots:
      if _s.material and _s.material.name.startswith('M_env_palette.') and _pal: _s.material=_pal
for _m in bpy.data.materials:
  if _m.node_tree:
    for _n in _m.node_tree.nodes:
      if _n.type=='TEX_IMAGE': _n.interpolation='Closest'
O=bpy.data.objects;S=bpy.context.scene
for o in O:
  if o.name.startswith('Icosphere'): o.hide_render=True;o.hide_set(True)
def c2b(v): return Vector((v[0],-v[2],v[1]))
ROOT=[-2.1135,0,5.2814]
for r in roots: r.location=c2b(ROOT);r.rotation_mode='XYZ';r.rotation_euler=(r.rotation_euler.x,r.rotation_euler.y,0)
door=O['env_lighthouse_door'];door.rotation_mode='XYZ';door.rotation_euler.z+=math.radians(86.4)
S.render.engine='BLENDER_EEVEE';S.eevee.taa_render_samples=A.get('samples',32)
for k,v in (('use_shadows',True),('shadow_ray_count',2),('shadow_step_count',8),('use_raytracing',False)):
  try: setattr(S.eevee,k,v)
  except Exception as e: print('opt',k,e)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));sun.data.energy=3.5;sun.rotation_mode='QUATERNION';sun.rotation_quaternion=Vector((-0.4330127,-0.75,0.5)).to_track_quat('Z','Y');  # game Main Light euler(-30,-30,0)
S.collection.objects.link(sun)
try: sun.data.angle=math.radians(2)
except: pass
if A.get('noshadow'): sun.data.use_shadow=False
for k,v in A.get('sunopts',{}).items():
  try: setattr(sun.data,k,v)
  except Exception as e: print('opt',k,e)
if A.get('closest',1):
  for m in bpy.data.materials:
    if m.node_tree:
      for n in m.node_tree.nodes:
        if n.type=='TEX_IMAGE': n.interpolation='Closest'
if A.get('fixmat'):
  for m in bpy.data.materials:
    for k,v in (('surface_render_method','DITHERED'),('use_transparent_shadow',False)):
      try: setattr(m,k,v)
      except Exception as e: pass
if not S.world: S.world=bpy.data.worlds.new('w')
S.world.color=(0.45,0.7,0.85);S.view_settings.view_transform='Standard'
exec(open('/tmp/b52/seafix.py').read())
cd=bpy.data.cameras.new('YJ');cam=bpy.data.objects.new('YJ_CAM',cd);S.collection.objects.link(cam);S.camera=cam
cd.sensor_fit='VERTICAL';cd.sensor_height=24.0;cd.clip_start=0.3;cd.clip_end=400
S.render.resolution_x,S.render.resolution_y=A['res'];S.render.resolution_percentage=100
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
sund=(sun.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
res={}
for P in A['poses']:
  pos=c2b(P['pos']);tg=c2b(P['target']);fw=(tg-pos).normalized()
  cam.location=pos;cam.rotation_mode='QUATERNION';cam.rotation_quaternion=fw.to_track_quat('-Z','Y');cd.lens=12/math.tan(math.radians(P['fov'])/2)
  bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
  # shadow on her: rays to sun from body points
  sh={}
  for tag,h in (('feet',.1),('chest',1.2),('face',1.55)):
    q=c2b([ROOT[0],h,ROOT[2]])+sund*0.6;hit,loc,n,i,ob,m=S.ray_cast(dg,q,sund)
    sh[tag]=ob.name if hit and ob not in chr_ and 'sky' not in ob.name and 'cloud' not in ob.name else ''
  # foreground occluders: grid of camera rays, first hit nearer than her distance that is a prop/foliage object
  dist=(c2b([ROOT[0],1,ROOT[2]])-pos).length;W,H=A['res'];asp=W/H;th=math.tan(math.radians(P['fov'])/2)
  R=cam.matrix_world.to_3x3();fg={};tot=0;cover={}
  for iy in range(48):
    for ix in range(24):
      u=(ix+.5)/24*2-1;v=(iy+.5)/48*2-1;d=(R@Vector((u*th*asp,v*th,-1))).normalized();hit,loc,n,i,ob,m=S.ray_cast(dg,pos,d);tot+=1
      if hit:
        nm=ob.name;cover[nm]=cover.get(nm,0)+1
        if ob in propobjs or 'palm' in nm or 'prop' in nm or 'tree' in nm or 'leaf' in nm or 'bush' in nm:
          if (loc-pos).length<dist: fg[nm]=fg.get(nm,0)+1
      else: cover['<sky/sea>']=cover.get('<sky/sea>',0)+1
  # her line of sight
  los={}
  for tag,h in (('feet',.05),('chest',1.2),('face',1.55),('head',1.72)):
    q=c2b([ROOT[0],h,ROOT[2]]);d=q-pos;hit,loc,n,i,ob,m=S.ray_cast(dg,pos,d.normalized(),distance=d.length-.05);los[tag]=ob.name if hit and ob not in chr_ else ''
  res[P['name']]=dict(shadowOnHer=sh,foregroundPropRaysNearerThanHer=fg,lineOfSight=los,cover={k:round(v/tot,3) for k,v in sorted(cover.items(),key=lambda x:-x[1])[:12]})
  if A.get('render',1):
    S.render.filepath=f"{A['out']}/{P['name']}.png";bpy.ops.render.render(write_still=True)
json.dump(res,open(A['out']+'/checks.json','w'),indent=1);print('RES',json.dumps(res))
