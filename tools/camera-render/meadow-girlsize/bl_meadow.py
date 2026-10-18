# Blender 4.5 offline stills of the meadow board: current pose vs girl-size options A/B/C.
# blender -b -P bl_meadow.py -- SHOTS_JSON OUTDIR [name_filter]      (SHOTS_JSON from eval_options.cjs)
# Env: TREE (repo root), SAMPLES (default 12). Proxy look only (real env_meadow.glb + character GLB, sun + sky colour).
import bpy,sys,json,math,os,mathutils
a=sys.argv[sys.argv.index('--')+1:]; data=json.load(open(a[0])); out=a[1]; filt=a[2] if len(a)>2 else ''
os.makedirs(out,exist_ok=True)
TREE=os.environ.get('TREE',os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..')))
BUN=os.path.join(TREE,'creator-build-project/assets/bundles')
B=lambda p:(p[0],-p[2],p[1])
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def imp(path):
  before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in before]
mea=imp(os.path.join(BUN,'region_meadow/env_meadow.glb'))
chr_=imp(os.path.join(BUN,'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'))
for o in chr_:
  if o.name.startswith('Icosphere'): o.hide_render=True
hc=bpy.data.objects.new('girl_root',None); bpy.context.scene.collection.objects.link(hc)
for o in chr_:
  if o.parent is None: o.parent=hc
arm=[o for o in chr_ if o.type=='ARMATURE']
act=next((x for x in bpy.data.actions if x.name.startswith('idle_breathing')),None) or next((x for x in bpy.data.actions if x.name.startswith('idle')),None)
if arm and act:
  arm[0].animation_data_create(); arm[0].animation_data.action=act
  try:
    if hasattr(act,'slots') and len(act.slots): arm[0].animation_data.action_slot=act.slots[0]
  except Exception as e: print('slot',e)
  bpy.context.scene.frame_set(int(act.frame_range[0]))
print('CHAR action',act and act.name)
# option D: bend world meshes (not her, not sky) in world space. Original world verts kept so each shot re-bends from flat.
NOBEND=('meadow_sky_dome','meadow_clouds_near','meadow_far_hills')
src={}
for o in mea:
  if o.type!='MESH' or o.name.startswith(NOBEND): continue
  o.data=o.data.copy(); mw=o.matrix_world.copy(); src[o.name]=(o,mw,[mw@v.co for v in o.data.vertices])
def bend(b):
  for o,mw,ws in src.values():
    inv=mw.inverted()
    for v,wp in zip(o.data.vertices,ws):
      x,y,z=wp.x,wp.y,wp.z   # Blender: Cocos x=x, Cocos z=-y
      if b:
        cx,cz=b['cx'],-b['cz']; d=((y-cz)**2 if b['mode']=='cyl' else (x-cx)**2+(y-cz)**2)/(2*b['R']); z-=d
      v.co=inv@mathutils.Vector((x,y,z))
    o.data.update()
cur=['flat']
sc=bpy.context.scene
try: sc.render.engine='BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine='BLENDER_EEVEE'
sc.eevee.taa_render_samples=int(os.environ.get('SAMPLES','12'))
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.42,0.66,0.95,1)
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.rotation_euler=(math.radians(40),0,math.radians(150)); sun.data.energy=3.2
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
cam.data.sensor_fit='VERTICAL'; cam.data.clip_start=0.1; cam.data.clip_end=2000
for s in data['shots']:
  if filt and filt not in s['name']: continue
  key=json.dumps(s.get('bend'))
  if key!=cur[0]: bend(s.get('bend')); cur[0]=key
  hc.location=B(s['foot']); hc.rotation_euler=(0,0,math.radians(s.get('faceDeg',180)))
  c=s['cam']; p=mathutils.Vector(B(c['position'])); t=mathutils.Vector(B(c['target']))
  cam.location=p; cam.rotation_euler=(t-p).to_track_quat('-Z','Y').to_euler(); cam.data.angle=math.radians(c['fovVerticalDeg'])
  sc.render.resolution_x=s['w']; sc.render.resolution_y=s['h']; sc.render.resolution_percentage=100
  sc.render.filepath=os.path.join(out,s['name']+'.png'); bpy.ops.render.render(write_still=True); print('WROTE',sc.render.filepath,flush=True)
