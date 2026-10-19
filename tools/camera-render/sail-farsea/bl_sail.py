# Blender 4.5 offline stills of the sail far-sea shot (K3 day / K7 night), before vs after.
# blender -b -P bl_sail.py -- SHOTS_JSON OUTDIR [name_filter]
# Env: TREE (repo root, default: two dirs up from this file), SAMPLES (default 16), MASK=1 also writes <name>_mask.png (windmill white).
# Proxy look: real meadow / island / sailboat / character GLBs, flat sea plane at the waterline, sun + sky colour.
# It is a framing/readability check, not a shader match for Cocos (wake, foam and sea props are not drawn).
import bpy,sys,json,math,os,mathutils
a=sys.argv[sys.argv.index('--')+1:]; data=json.load(open(a[0])); out=a[1]; filt=a[2] if len(a)>2 else ''
os.makedirs(out,exist_ok=True)
TREE=os.environ.get('TREE',os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..')))
BUN=os.path.join(TREE,'creator-build-project/assets/bundles')
B=lambda p:(p[0],-p[2],p[1])   # glTF/Cocos (Y up) -> Blender (Z up)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def imp(path):
  before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
def holder(name,objs):
  h=bpy.data.objects.new(name,None); bpy.context.scene.collection.objects.link(h)
  for o in objs:
    if o.parent is None: o.parent=h
  return h
isl=imp(os.path.join(BUN,'static_seat_preview/room/room_no_original_chair.glb'))
mea=imp(os.path.join(BUN,'region_meadow/env_meadow.glb'))
hm=holder('meadow_root',mea); r=data['meadowRoot']; hm.location=B(r); hm.rotation_euler=(0,0,math.pi)
boat=imp(os.path.join(BUN,'transport_sail/sailboat.glb')); hb=holder('boat_root',boat)
for o in boat:
  if o.name.startswith('sail_furled'): o.hide_render=True
chr_=imp(os.path.join(BUN,'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'))
for o in chr_:
  if o.name.startswith('Icosphere'): o.hide_render=True
hc=holder('girl_root',chr_); hc.parent=hb; hc.location=B([0,0.06,-0.55])
arm=[o for o in chr_ if o.type=='ARMATURE']
act=bpy.data.actions.get('sit_hold') or next((x for x in bpy.data.actions if x.name.startswith('sit_hold')),None)
if arm and act:
  arm[0].animation_data_create(); arm[0].animation_data.action=act
  try:
    sl=act.slots[0] if hasattr(act,'slots') and len(act.slots) else None
    if sl: arm[0].animation_data.action_slot=sl
  except Exception as e: print('slot',e)
  bpy.context.scene.frame_set(int(act.frame_range[0]))
print('CHAR action',act and act.name)
def named(objs,prefix): return [o for o in objs if o.name.startswith(prefix)]
mill=[o for o in mea if o.name.startswith('windmill_static_merged') or o.name.startswith('windmill_sails')]
for o in mea:
  if o.name.startswith('meadow_far_hills'): o.hide_render=True
# sea
bpy.ops.mesh.primitive_plane_add(size=1600,location=(0,0,data['waterY'])); sea=bpy.context.object; sea.name='sea_proxy'
sm=bpy.data.materials.new('sea'); sm.use_nodes=True; sb=sm.node_tree.nodes['Principled BSDF']; sb.inputs['Roughness'].default_value=0.35; sea.data.materials.append(sm)
sc=bpy.context.scene
try: sc.render.engine='BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine='BLENDER_EEVEE'
sc.eevee.taa_render_samples=int(os.environ.get('SAMPLES','16'))
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.rotation_euler=(math.radians(40),0,math.radians(150))
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
cam.data.sensor_fit='VERTICAL'; cam.data.clip_start=0.1; cam.data.clip_end=2000
day_dome=named(isl,'env_sky_dome'); night_dome=named(mea,'meadow_sky_dome')
orig={}
def set_mask(on):
  if on:
    white=bpy.data.materials.get('MW') or bpy.data.materials.new('MW'); black=bpy.data.materials.get('MK') or bpy.data.materials.new('MK')
    for m,c in ((white,(1,1,1,1)),(black,(0,0,0,1))):
      m.use_nodes=True; nt=m.node_tree; nt.nodes.clear(); e=nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value=c; o_=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o_.inputs['Surface'])
    for o in bpy.data.objects:
      if o.type!='MESH': continue
      orig[o.name]=[s.material for s in o.material_slots]
      for s in o.material_slots: s.link='OBJECT'; s.material=white if o in mill else black
    bg.inputs['Color'].default_value=(0,0,0,1); sun.hide_render=True
  else:
    for o in bpy.data.objects:
      if o.name in orig:
        for s in o.material_slots: s.link='OBJECT'; s.material=None; s.link='DATA'
    orig.clear(); sun.hide_render=False
def look(c):
  p=mathutils.Vector(B(c['position'])); t=mathutils.Vector(B(c['target']))
  cam.location=p; cam.rotation_euler=(t-p).to_track_quat('-Z','Y').to_euler(); cam.data.angle=math.radians(c.get('fovVerticalDeg',48))
for s in data['shots']:
  if filt and filt not in s['name']: continue
  night=s['night']
  for o in day_dome: o.hide_render=night
  for o in night_dome: o.hide_render=not night
  bg.inputs['Color'].default_value=(0.03,0.05,0.12,1) if night else (0.42,0.66,0.95,1); bg.inputs['Strength'].default_value=0.6 if night else 1.0
  sun.data.energy=0.6 if night else 3.2; sun.data.color=(0.6,0.7,1.0) if night else (1.0,0.96,0.9)
  sb.inputs['Base Color'].default_value=(0.04,0.08,0.22,1) if night else (0.05,0.38,0.8,1)
  hb.location=B(s['boat']['pos']); hb.rotation_euler=(0,0,s['boat']['yaw'])
  look(s['cam']); sc.render.resolution_x=s['w']; sc.render.resolution_y=s['h']; sc.render.resolution_percentage=100
  sc.render.filepath=os.path.join(out,s['name']+'.png'); bpy.ops.render.render(write_still=True); print('WROTE',sc.render.filepath)
  if os.environ.get('MASK')=='1':
    set_mask(True); sc.render.filepath=os.path.join(out,s['name']+'_mask.png'); bpy.ops.render.render(write_still=True); set_mask(False)
    for o in day_dome: o.hide_render=night
