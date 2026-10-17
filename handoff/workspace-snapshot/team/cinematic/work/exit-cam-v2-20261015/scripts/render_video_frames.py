# Blender Workbench (textured) render of outbound frames for each variant at 0.46 portrait. .blend never saved.
import bpy, json, sys, math
from mathutils import Vector
A=json.loads(open(sys.argv[sys.argv.index('--')+1]).read())
R='/workspace/wechat-game/yiqifengle/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=R+'creator-project/assets/firstslice/combined_visual_m.glb')
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=R+'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
roots=[o for o in bpy.data.objects if o not in before and o.parent is None]
O=bpy.data.objects; S=bpy.context.scene
for o in O:
  if o.name.startswith('Icosphere'): o.hide_render=True
def c2b(v): return Vector((v[0],-v[2],v[1]))
door=O['env_lighthouse_door']; door.rotation_mode='XYZ'; d0=door.rotation_euler.copy()
S.render.engine='BLENDER_WORKBENCH'; S.display.shading.light='STUDIO'; S.display.shading.color_type='TEXTURE'
S.display.shading.show_shadows=True; S.display.shading.background_type='WORLD'
if not S.world: S.world=bpy.data.worlds.new('w')
S.world.color=(0.45,0.7,0.85); S.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('YJ'); cam=bpy.data.objects.new('YJ_CAM',cd); S.collection.objects.link(cam); S.camera=cam
cd.sensor_fit='VERTICAL'; cd.sensor_height=24.0; cd.clip_start=0.05; cd.clip_end=1500
S.render.resolution_x,S.render.resolution_y=A['res']; S.render.resolution_percentage=100
for v in A['variants']:
  F=json.load(open(v['frames']))['frames']; T=A['duration']; n=int(T*A['fps'])+1
  for i in range(n):
    t=i/A['fps']; f=min(F,key=lambda x:abs(x['t']-t)) if t<=F[-1]['t'] else F[-1]
    P=c2b(f['pos']); fw=c2b(f['fwd']); cam.location=P; cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=fw.normalized().to_track_quat('-Z','Y')
    cd.lens=12.0/math.tan(math.radians(f['fov'])/2)
    door.rotation_euler=d0.copy(); door.rotation_euler.z+=math.radians(f['door'] if f['door'] is not None else 86.4)
    for r in roots: r.location=c2b(f['root']); r.rotation_mode='XYZ'; r.rotation_euler=(r.rotation_euler.x,r.rotation_euler.y,f['yaw'])
    S.render.filepath=f"{A['outdir']}/{v['name']}_{i:04d}.png"; bpy.ops.render.render(write_still=True)
print('DONE')
