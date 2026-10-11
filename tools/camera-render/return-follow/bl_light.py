# Blender 4.5 offline renders of the return driven by the per-frame REAL RoomLightingRig state (lightframes.cjs).
# blender -b -P bl_light.py -- ISLAND_GLB CHAR_GLB FRAMES_JSON OUTDIR [start] [step] [only_names_csv]
# Env: RES_PCT (default 25), SAMPLES (default 8). Fixed exposure for every frame (Cocos HDR camera default EV100=15).
import bpy,sys,json,math,mathutils,os
a=sys.argv[sys.argv.index('--')+1:]; isl,chr_,frames,outdir=a[0],a[1],json.load(open(a[2])),a[3]
start=int(a[4]) if len(a)>4 else 0; step=int(a[5]) if len(a)>5 else 1; only=set(a[6].split(',')) if len(a)>6 and a[6] else None
EXPO=1.0/(1.2*2**15)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=isl); envobjs=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=chr_); chobjs=[o for o in bpy.data.objects if o not in envobjs]
UNLIT=('env_sky_dome','env_cloud_layer','env_sea_foam','env_sea_surf_foam_v22','env_sea_wave_line_01_v22','env_sea_wave_line_02_v22')
LAYER={'interior':('env_interior_shell','env_interior_glass','env_interior_props_merged','env_int_anim_','env_window_blind_cards'),
       'backdrop':('env_sea_surface','env_sea_foam','env_sky_dome','env_cloud_layer','env_rear_window_'),'door':('env_lighthouse_door',),
       'ext_or_int':('env_lighthouse_ext',)}
def top(o):
  while o.parent and o.parent.name!='scene_root' and o.parent.parent is not None: o=o.parent
  return o
def layer_of(o):
  n=o.name
  for k,ps in LAYER.items():
    if any(n.startswith(p) for p in ps): return k
  if n.startswith('fx_') or 'moon' in n or 'beam' in n: return 'hidden'   # night-only / fx (day render)
  return 'exterior'
def mesh_layer(o):
  p=o
  while p is not None:
    l=layer_of(p)
    if l!='exterior' or p.parent is None or p.parent.name=='scene_root': return l
    p=p.parent
  return 'exterior'
meshes=[o for o in envobjs if o.type=='MESH']; ml={o.name:mesh_layer(o) for o in meshes}
from collections import Counter; print('LAYERS',Counter(ml.values()))
OPAQUE_SKIP=('glass','sky','cloud','foam','beam','halo','glow','window_view')
unlit_mats=set()
for o in meshes:
  if any(o.name.startswith(p) for p in UNLIT) or (o.parent and any(o.parent.name.startswith(p) for p in UNLIT)):
    for s in o.material_slots:
      if s.material: unlit_mats.add(s.material.name)
for m in bpy.data.materials:
  if not m.use_nodes: continue
  nt=m.node_tree
  for l in nt.links:
    if l.to_socket.name=='Base Color' and l.from_node.type=='TEX_IMAGE': nt.nodes.active=l.from_node
  bsdf=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']
  if m.name in unlit_mats and bsdf:
    b=bsdf[0]; src=b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    em=nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value=1.0
    if src: nt.links.new(src,em.inputs['Color'])
    else: em.inputs['Color'].default_value=b.inputs['Base Color'].default_value
    out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'][0]
    if 'foam' in m.name.lower() or 'cloud' in m.name.lower():
      mix=nt.nodes.new('ShaderNodeMixShader'); tr=nt.nodes.new('ShaderNodeBsdfTransparent')
      if b.inputs['Alpha'].links: nt.links.new(b.inputs['Alpha'].links[0].from_socket,mix.inputs[0])
      else: mix.inputs[0].default_value=b.inputs['Alpha'].default_value
      nt.links.new(tr.outputs[0],mix.inputs[1]); nt.links.new(em.outputs[0],mix.inputs[2]); nt.links.new(mix.outputs[0],out.inputs['Surface'])
    else: nt.links.new(em.outputs[0],out.inputs['Surface'])
    continue
  if any(k in m.name.lower() for k in OPAQUE_SKIP): continue
  for n in bsdf:
    for l in list(n.inputs['Alpha'].links): nt.links.remove(l)
    n.inputs['Alpha'].default_value=1.0
    if m.name.startswith('M_env_palette'):
      for l in list(n.inputs['Emission Color'].links): nt.links.remove(l)
      n.inputs['Emission Strength'].default_value=0.0
  try: m.blend_method='OPAQUE'
  except Exception: pass
# Cocos-style ambient: unoccluded hemisphere mix(ground, sky, 0.5+0.5*n.up) * skyIllum * exposure * albedo, added as emission
# (no GI bounces, no ambient occlusion: like the runtime forward pipeline). One node group, updated per frame.
AG=bpy.data.node_groups.new('AMB','ShaderNodeTree')
AG.interface.new_socket('Albedo',in_out='INPUT',socket_type='NodeSocketColor'); AG.interface.new_socket('Shader',in_out='OUTPUT',socket_type='NodeSocketShader')
gi=AG.nodes.new('NodeGroupInput'); go=AG.nodes.new('NodeGroupOutput'); geo=AG.nodes.new('ShaderNodeNewGeometry'); sp=AG.nodes.new('ShaderNodeSeparateXYZ')
AG.links.new(geo.outputs['Normal'],sp.inputs[0]); rm=AG.nodes.new('ShaderNodeMapRange'); rm.inputs['From Min'].default_value=-1; AG.links.new(sp.outputs['Z'],rm.inputs['Value'])
hm=AG.nodes.new('ShaderNodeMix'); hm.data_type='RGBA'; hm.name='HEMI'; AG.links.new(rm.outputs[0],hm.inputs['Factor'])
mu=AG.nodes.new('ShaderNodeMix'); mu.data_type='RGBA'; mu.blend_type='MULTIPLY'; mu.inputs['Factor'].default_value=1
AG.links.new(gi.outputs['Albedo'],mu.inputs['A']); AG.links.new(hm.outputs['Result'],mu.inputs['B'])
ae=AG.nodes.new('ShaderNodeEmission'); ae.name='AMBEM'; AG.links.new(mu.outputs['Result'],ae.inputs['Color']); AG.links.new(ae.outputs[0],go.inputs['Shader'])
for m in bpy.data.materials:
  if not m.use_nodes or m.name in unlit_mats: continue
  nt=m.node_tree; out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL']; b=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']
  if not out or not b or not out[0].inputs['Surface'].links: continue
  srf=out[0].inputs['Surface'].links[0].from_socket; g=nt.nodes.new('ShaderNodeGroup'); g.node_tree=AG
  if b[0].inputs['Base Color'].links: nt.links.new(b[0].inputs['Base Color'].links[0].from_socket,g.inputs['Albedo'])
  else: g.inputs['Albedo'].default_value=b[0].inputs['Base Color'].default_value
  ad=nt.nodes.new('ShaderNodeAddShader'); nt.links.new(srf,ad.inputs[0]); nt.links.new(g.outputs[0],ad.inputs[1]); nt.links.new(ad.outputs[0],out[0].inputs['Surface'])
  try: m.cycles.emission_sampling='NONE'
  except Exception: pass
_door=[o for o in envobjs if o.name.startswith('env_lighthouse_door') and (o.parent is None or not o.parent.name.startswith('env_lighthouse_door'))]
for o in _door: o.rotation_mode='QUATERNION'; o['q0']=list(o.rotation_quaternion)
for o in chobjs:
  if o.name.startswith('Icosphere'): o.hide_render=True
roots=[o for o in chobjs if o.parent is None and not o.name.startswith('Icosphere')]
arm=[o for o in chobjs if o.type=='ARMATURE'][0]
holder=bpy.data.objects.new('chr_holder',None); bpy.context.scene.collection.objects.link(holder)
for r in roots: r.parent=holder
sc=bpy.context.scene
if os.environ.get('ENGINE','CYCLES')=='CYCLES':
  sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(os.environ.get('SAMPLES','16')); sc.cycles.use_denoising=os.environ.get('DENOISE')=='1'
  sc.cycles.max_bounces=8; sc.cycles.diffuse_bounces=0; sc.cycles.glossy_bounces=0; sc.cycles.transparent_max_bounces=8; sc.cycles.use_adaptive_sampling=False
  sc.render.use_persistent_data=True; sc.cycles.seed=0
else:
  sc.render.engine='BLENDER_EEVEE_NEXT'; sc.eevee.taa_render_samples=int(os.environ.get('SAMPLES','8'))
sc.render.resolution_x=586; sc.render.resolution_y=1266; sc.render.resolution_percentage=int(os.environ.get('RES_PCT','25'))
sc.view_settings.view_transform='AgX'; sc.view_settings.look='None'; sc.view_settings.exposure=0
# world: camera rays see a constant sky colour (the sky dome mesh normally covers it); lighting rays = hemisphere ambient
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; nt.nodes.clear()
outw=nt.nodes.new('ShaderNodeOutputWorld'); lp=nt.nodes.new('ShaderNodeLightPath'); tc=nt.nodes.new('ShaderNodeTexCoord')
sep=nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'],sep.inputs[0])
mr=nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value=-1; mr.inputs['From Max'].default_value=1; nt.links.new(sep.outputs['Z'],mr.inputs['Value'])
mixc=nt.nodes.new('ShaderNodeMix'); mixc.data_type='RGBA'; nt.links.new(mr.outputs[0],mixc.inputs['Factor'])
amb=nt.nodes.new('ShaderNodeBackground'); nt.links.new(mixc.outputs['Result'],amb.inputs['Color'])
camb=nt.nodes.new('ShaderNodeBackground'); camb.inputs['Color'].default_value=(.55,.75,.95,1); camb.inputs['Strength'].default_value=1
ms=nt.nodes.new('ShaderNodeMixShader'); nt.links.new(lp.outputs['Is Camera Ray'],ms.inputs[0]); nt.links.new(amb.outputs[0],ms.inputs[1]); nt.links.new(camb.outputs[0],ms.inputs[2]); nt.links.new(ms.outputs[0],outw.inputs[0])
def sun(name,shadow):
  d=bpy.data.lights.new(name,'SUN'); d.use_shadow=shadow; d.angle=math.radians(1.0); o=bpy.data.objects.new(name,d); sc.collection.objects.link(o); o.rotation_mode='QUATERNION'; return o
sunS=sun('sunShadow',True); sunN=sun('sunNoShadow',False)
cd=bpy.data.cameras.new('cam'); cd.sensor_fit='VERTICAL'; cd.clip_start=0.05; cd.clip_end=1000
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
conv=mathutils.Quaternion((1,0,0),math.radians(90))
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
acts={a.name:a for a in bpy.data.actions}; print('ACTIONS',sorted(acts)[:20])
lastvis=None
for k,s in enumerate(frames):
  if k<start or (k-start)%step: continue
  if only and s['name'] not in only: continue
  L=s['layers']; vis=json.dumps(L,sort_keys=True)
  if vis!=lastvis:
    lastvis=vis
    for o in meshes:
      l=ml[o.name]; on= (L['interior'] or L['exterior']) if l=='ext_or_int' else (False if l=='hidden' else bool(L.get(l)) or (l=='interior' and L.get('doorwayInterior')))
      o.hide_render=not on
  q=s['rot']; qc=mathutils.Quaternion((q[3],q[0],q[1],q[2]))
  cam.location=bl(s['pos']); cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=conv@qc
  cd.lens_unit='FOV'; cd.angle=math.radians(s['fov'])
  holder.location=bl(s['root']); holder.rotation_euler=(0,0,float(s['yaw'])); holder.scale=(1.0611643605259733,)*3
  act=acts.get(s['clip']) or acts.get('walk_loop'); arm.animation_data_create(); arm.animation_data.action=act
  for o in _door: o.rotation_quaternion=mathutils.Quaternion(o['q0'])@mathutils.Quaternion((0,0,1),math.radians(s['door']))
  fps=sc.render.fps/sc.render.fps_base; a0,a1=act.frame_range; Lr=max(1.0,a1-a0)
  fr=a0+((s['clipTime']*fps)%Lr if s['clip'] in ('walk_loop','idle_breathing_loop') else s.get('clipU',0)*Lr); sc.frame_set(int(fr),subframe=fr-int(fr))
  d=bl(s['sunDir']).normalized(); rq=mathutils.Vector((0,0,-1)).rotation_difference(d)
  col=[c/255 for c in s['sunC']]; I=s['sunI']*EXPO; sat=max(0.0,min(1.0,s['shadowSat'] if s['shadowOn'] else 0.0))
  for o,f in ((sunS,sat),(sunN,1-sat)): o.rotation_quaternion=rq; o.data.color=col; o.data.energy=I*f
  A=s['amb']*EXPO; hm=AG.nodes['HEMI']; hm.inputs['A'].default_value=(*s['ground'],1); hm.inputs['B'].default_value=(*s['sky'],1); AG.nodes['AMBEM'].inputs['Strength'].default_value=A
  amb.inputs['Strength'].default_value=0.0
  sc.render.filepath=os.path.join(outdir,s['name']+'.png'); bpy.ops.render.render(write_still=True)
  print('RENDERED',s['name'],s['t'],s['state'],flush=True)
