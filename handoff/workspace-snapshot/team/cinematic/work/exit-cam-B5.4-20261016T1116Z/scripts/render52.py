# Blender EEVEE (sun + world colour, same look as exit-cam-v2 island_check.py) offline preview of flow_sim exit frames. NOT a Cocos capture. .blend never saved.
import bpy, json, sys, math
from mathutils import Vector
A=json.loads(open(sys.argv[sys.argv.index('--')+1]).read())
R='/tmp/wt-b5/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/wechat-game/yiqifengle/creator-project/assets/firstslice/combined_visual_m.glb')
for p in A['props']:
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p['glb'])
  for o in [o for o in bpy.data.objects if o not in before and o.parent is None]:
    o.location=(p['position'][0],-p['position'][2],p['position'][1]);o.rotation_mode='XYZ';o.rotation_euler.z+=math.radians(p['yawDeg']);o.scale=[s*p['scale'] for s in o.scale]
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=R+'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
roots=[o for o in bpy.data.objects if o not in before and o.parent is None]

_pal=bpy.data.materials.get('M_env_palette')
for _o in bpy.data.objects:
  if _o.type=='MESH':
    for _s in _o.material_slots:
      if _s.material and _s.material.name.startswith('M_env_palette.') and _pal: _s.material=_pal
for _m in bpy.data.materials:
  if _m.node_tree:
    for _n in _m.node_tree.nodes:
      if _n.type=='TEX_IMAGE': _n.interpolation='Closest'
O=bpy.data.objects; S=bpy.context.scene
for o in O:
  if o.name.startswith('Icosphere'): o.hide_render=True
def c2b(v): return Vector((v[0],-v[2],v[1]))
door=O['env_lighthouse_door']; door.rotation_mode='XYZ'; d0=door.rotation_euler.copy()
S.render.engine='BLENDER_EEVEE'
try:
  S.eevee.taa_render_samples=A.get('samples',16)
except Exception as e: print('samples',e)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sun.data.energy=3.5; sun.rotation_mode='QUATERNION';sun.rotation_quaternion=Vector((-0.4330127,-0.75,0.5)).to_track_quat('Z','Y');
S.collection.objects.link(sun)
if not S.world: S.world=bpy.data.worlds.new('w')
S.world.color=(0.45,0.7,0.85); S.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('YJ'); cam=bpy.data.objects.new('YJ_CAM',cd); S.collection.objects.link(cam); S.camera=cam
cd.sensor_fit='VERTICAL'; cd.sensor_height=24.0; cd.clip_start=0.3; cd.clip_end=400
S.render.resolution_x,S.render.resolution_y=A['res']; S.render.resolution_percentage=100
F=json.load(open(A['frames']))['frames']
for i in A['indices']:
  t=i/A['fps']; f=min(F,key=lambda x:abs(x['t']-t)) if t<=F[-1]['t'] else F[-1]
  cam.location=c2b(f['pos']); fw=c2b(f['fwd']); cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=fw.normalized().to_track_quat('-Z','Y')
  cd.lens=12.0/math.tan(math.radians(f['fov'])/2)
  door.rotation_euler=d0.copy(); door.rotation_euler.z+=math.radians(f['door'] if f['door'] is not None else 86.4)
  for r in roots: r.location=c2b(f['root']); r.rotation_mode='XYZ'; r.rotation_euler=(r.rotation_euler.x,r.rotation_euler.y,f['yaw'])
  S.render.filepath=f"{A['outdir']}/{A['name']}_{i:04d}.png"; bpy.ops.render.render(write_still=True)
print('DONE')
