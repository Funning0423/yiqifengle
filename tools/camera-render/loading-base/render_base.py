# Blender 4.5 offline render of the room home camera for the loading-page base (preview only, not shipped).
# blender -b -P render_base.py -- ROOM_GLB CHAR_GLB SHOT_JSON OUT_PNG [ENGINE=EEVEE|WORKBENCH]
# Env: LB_SHIFT_Y (lens shift, frame units, default 0), LB_RES_PCT, LB_FSTOP (0 = no DOF), LB_SAMPLES
import bpy,sys,json,math,mathutils,os
a=sys.argv[sys.argv.index('--')+1:]; room,chr_,shot,out=a[0],a[1],json.load(open(a[2]))[0],a[3]
ENGINE=a[4] if len(a)>4 else 'EEVEE'
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=room); roomobjs=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=chr_); chobjs=[o for o in bpy.data.objects if o not in roomobjs]
for m in bpy.data.materials:
  if not m.use_nodes: continue
  for l in m.node_tree.links:
    if l.to_socket.name=='Base Color' and l.from_node.type=='TEX_IMAGE': m.node_tree.nodes.active=l.from_node
# Runtime draws M_env_palette & friends opaque; glTF import wires the palette texture alpha into Alpha (HASHED),
# which EEVEE dithers to black speckles. Force opaque for everything that is not glass/sky/cloud/foam/beam/halo.
OPAQUE_SKIP=('glass','sky','cloud','foam','beam','halo','glow','window_view')
for m in bpy.data.materials:
  if not m.use_nodes or any(k in m.name.lower() for k in OPAQUE_SKIP): continue
  for n in m.node_tree.nodes:
    if n.type=='BSDF_PRINCIPLED':
      for l in list(n.inputs['Alpha'].links): m.node_tree.links.remove(l)
      n.inputs['Alpha'].default_value=1.0
  # Day render: drop the palette emissive map (night window/lamp glow); EEVEE 4.5 renders it as black speckle here.
  if m.name.startswith('M_env_palette') and os.environ.get('LB_KEEP_EMIT')!='1':
    for n in m.node_tree.nodes:
      if n.type=='BSDF_PRINCIPLED':
        for l in list(n.inputs['Emission Color'].links): m.node_tree.links.remove(l)
        n.inputs['Emission Strength'].default_value=0.0
  try: m.blend_method='OPAQUE'
  except Exception: pass
for o in chobjs:
  if o.name.startswith('Icosphere'): o.hide_render=True
for o in roomobjs:   # night-only / exterior FX meshes that runtime hides by day
  if any(o.name.startswith(p) for p in ('env_lighthouse_beam','env_sky_moon')): o.hide_render=True
roots=[o for o in chobjs if o.parent is None and not o.name.startswith('Icosphere')]
arm=[o for o in chobjs if o.type=='ARMATURE'][0]
holder=bpy.data.objects.new('chr_holder',None); bpy.context.scene.collection.objects.link(holder)
for r in roots: r.parent=holder
sc=bpy.context.scene
W,H=750,1624
sc.render.resolution_x=W; sc.render.resolution_y=H; sc.render.resolution_percentage=int(os.environ.get('LB_RES_PCT','100'))
sc.view_settings.view_transform=os.environ.get('LB_VIEW','AgX'); sc.view_settings.look='None'
w=sc.world or bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes.get('Background'); bg.inputs[0].default_value=(1.0,0.93,0.82,1); bg.inputs[1].default_value=float(os.environ.get('LB_WORLD','0.9'))
if ENGINE=='WORKBENCH':
  sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='TEXTURE'; sh.show_shadows=True; sh.shadow_intensity=0.2
else:
  sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
  sc.eevee.taa_render_samples=int(os.environ.get('LB_SAMPLES','32'))
  try: sc.eevee.use_shadows=True
  except: pass
  # warm day sun roughly through the arched window (+Z/-X side seen in frame), plus soft fill at the lens
  sd=bpy.data.lights.new('sun','SUN'); sd.energy=float(os.environ.get('LB_SUN','3.0')); sd.color=(1.0,0.90,0.74); sd.angle=math.radians(12); sd.use_shadow=False
  so=bpy.data.objects.new('sun',sd); sc.collection.objects.link(so); so.rotation_euler=(math.radians(55),0,math.radians(-120))
  fd=bpy.data.lights.new('fill','AREA'); fd.energy=float(os.environ.get('LB_FILL','120')); fd.color=(1.0,0.93,0.84); fd.size=3; fd.use_shadow=False
  fo=bpy.data.objects.new('fill',fd); sc.collection.objects.link(fo)
cd=bpy.data.cameras.new('cam'); cd.sensor_fit='VERTICAL'; cd.clip_start=0.05; cd.clip_end=1000
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
conv=mathutils.Quaternion((1,0,0),math.radians(90))
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
s=shot; q=s['rot']; qc=mathutils.Quaternion((q[3],q[0],q[1],q[2]))
cam.location=bl(s['pos']); cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=conv@qc
cd.lens_unit='FOV'; cd.angle=math.radians(s['fov']); cd.shift_y=float(os.environ.get('LB_SHIFT_Y','0'))
holder.location=bl(s['root']); holder.rotation_euler=(0,0,float(s['yaw'])); holder.scale=(1.0611643605259733,)*3
if ENGINE!='WORKBENCH':
  fo.location=cam.location+mathutils.Vector((0,0,0.6)); fo.rotation_mode='QUATERNION'; fo.rotation_quaternion=cam.rotation_quaternion
fs=float(os.environ.get('LB_FSTOP','0'))
if fs>0:
  cd.dof.use_dof=True; cd.dof.focus_distance=(bl([s['root'][0],1.0,s['root'][2]])-cam.location).length; cd.dof.aperture_fstop=fs
act=bpy.data.actions.get(s['clip']); arm.animation_data_create(); arm.animation_data.action=act
fps=sc.render.fps/sc.render.fps_base; a0,a1=act.frame_range; fr=a0+min(s.get('clipTime',0)*fps,a1-a0); sc.frame_set(int(fr),subframe=fr-int(fr))
print('POSE clip',s['clip'],'frame',fr,'range',a0,a1,'shift',cd.shift_y,'dof',fs)
if os.environ.get('LB_PRE'): exec(open(os.environ['LB_PRE']).read())
sc.render.image_settings.file_format='PNG'; sc.render.filepath=out; bpy.ops.render.render(write_still=True); print('RENDERED',out)
