"""b19 skycity face budget: before/after renders of the 4 comparison shots, day + night (the approved r5 night grade of
tools/scene-design/skycity-night/night_render.py: night_after state), EEVEE, 390x844 (portrait phone), mooring props included.
blender -b --factory-startup -P compare_render.py -- <env_skycity.glb> <cams.json> <out_prefix>"""
import bpy,json,math,os,sys
from mathutils import Vector,Quaternion
a=sys.argv[sys.argv.index('--')+1:];CITY,CAMS,OUTP=a[0],a[1],a[2]
B=os.path.normpath(os.path.dirname(os.path.abspath(__file__))+'/../../../creator-build-project/assets/bundles/region_skycity')+'/'  # siblings (soft sea, mooring props) always from the repo bundle
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=f);return [o for o in bpy.data.objects if o not in before]
city=imp(CITY);soft=imp(B+'env_sky_cloudsea_soft.glb');moor=imp(B+'sky_mooring_props.glb');objs=city+soft+moor;SOFTN=set(o.name for o in soft)
# mooring props carry an untextured stand-in: bind the city's M_sky_palette like RegionLoader.mountSkyMooring
pal=next(m for m in bpy.data.materials if m.name=='M_sky_palette')
for o in moor:
  if o.type=='MESH':
    for sl in o.material_slots:sl.material=pal
for o in objs:
  n=o.name
  if (n.startswith('state_') and not n.startswith('state_bridge_after')) or n.split('.')[0] in ('env_sky_cloudsea','env_sky_cumulus_far') or n.startswith('anchor_'):o.hide_render=True
def b(p):return Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=32;sc.render.resolution_x=390;sc.render.resolution_y=844;sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;nt=w.node_tree;bg=nt.nodes['Background']
amb=nt.nodes.new('ShaderNodeBackground');amb.inputs[0].default_value=(0.2*0.508,0.502*0.508,0.8*0.508,1);amb.inputs[1].default_value=1.0
lp=nt.nodes.new('ShaderNodeLightPath');mx=nt.nodes.new('ShaderNodeMixShader');out=nt.nodes['World Output']
nt.links.new(lp.outputs['Is Camera Ray'],mx.inputs[0]);nt.links.new(amb.outputs[0],mx.inputs[1]);nt.links.new(bg.outputs[0],mx.inputs[2]);nt.links.new(mx.outputs[0],out.inputs['Surface'])
sun=bpy.data.lights.new('sun','SUN');so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so)
q=Quaternion((0.9330127018922194,-0.25,-0.25,-0.06698729810778066));dc=q@Vector((0,0,-1));dirb=Vector((dc.x,-dc.z,dc.y))
so.rotation_euler=dirb.to_track_quat('-Z','Y').to_euler()
key=bpy.data.lights.new('key','POINT');key.shadow_soft_size=30;ko=bpy.data.objects.new('key',key);sc.collection.objects.link(ko);ko.location=b((-25,80,25))
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL';cd.clip_end=3000;cd.clip_start=0.1
for o in objs:
  if o.type!='MESH':continue
  tag='chr' if o.name.startswith('chr_') else ('sea' if o.name in SOFTN else None)
  if tag:
    for i,sl in enumerate(o.material_slots):
      if sl.material and sl.material.name.startswith('M_sky_palette') and not sl.material.name.startswith('M_sky_palette_emissive'):
        m2=sl.material.copy();m2.name=tag+'__'+sl.material.name;o.material_slots[i].material=m2
mul={}
for m in bpy.data.materials:
  if not m.use_nodes:continue
  p=[n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
  if not p:continue
  p=p[0];inp=p.inputs['Base Color'];mixn=m.node_tree.nodes.new('ShaderNodeMix');mixn.data_type='RGBA';mixn.blend_type='MULTIPLY';mixn.inputs['Factor'].default_value=1
  if inp.links:src=inp.links[0].from_socket;m.node_tree.links.remove(inp.links[0]);m.node_tree.links.new(src,mixn.inputs['A'])
  else:mixn.inputs['A'].default_value=inp.default_value
  m.node_tree.links.new(mixn.outputs['Result'],inp);mul[m.name]=mixn
em={}
for m in bpy.data.materials:
  if not m.use_nodes:continue
  for nd in m.node_tree.nodes:
    if nd.type=='BSDF_PRINCIPLED':em[m.name]=(nd,nd.inputs['Emission Strength'].default_value)
def srgb2lin(c):return [(x/255/12.92 if x/255<=0.04045 else ((x/255+0.055)/1.055)**2.4) for x in c]
EXPO=1/(1.2*2**15);SUN=125000*EXPO;KEY=0.2*4*math.pi*85**2
def state(s):  # = night_render.py state(): 'day' / 'night_after' (approved r5 night grade)
  night=s!='day';after=s=='night'
  bg.inputs[0].default_value=(*srgb2lin((0,12,68) if night else (0x9c,0xca,0xdf)),1);bg.inputs[1].default_value=1.0
  kc=[0xff,0xf3,0xda]
  if after:kc=[round(kc[i]*(180,198,232)[i]/255) for i in range(3)]
  key.color=srgb2lin(kc);key.energy=KEY*(0.35 if after else 1)
  sun.energy=SUN*(0.35 if night else 1);sun.color=srgb2lin((180,198,232) if night else (255,255,255))
  for name,(nd,base) in em.items():
    f=1
    if after and name.startswith('M_sky_cloud'):f=0.272
    if after and name.startswith('M_sky_palette_emissive'):f=0.45
    nd.inputs['Emission Strength'].default_value=base*f
  for name,mixn in mul.items():
    g=(1,1,1)
    if after:
      if name.startswith('chr__'):g=(0.325,)*3
      elif name.startswith('sea__'):g=(.35,.40,.55)
      elif name.startswith('M_sky_palette_emissive'):g=(1,1,1)
      elif name.startswith('M_sky_rock_strata'):g=(.55,.60,.75)
      elif name.startswith(('M_sky_palette','M_sky_foliage','M_sky_cloud')):g=(.12,.14,.20)
    mixn.inputs['B'].default_value=(*g,1)
C=json.load(open(CAMS))['compare']
for st in ('day','night'):
  state(st)
  for n,p in C.items():
    keyE=key.energy
    if n!='board':key.energy=0  # board key light only on the board rig
    pos,tgt=b(p['position']),b(p['target']);cam.location=pos;cam.rotation_euler=(tgt-pos).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(p['fovVerticalDeg'])
    sc.render.filepath=f'{OUTP}_{n}_{st}.png';bpy.ops.render.render(write_still=True);print('SHOT',n,st,flush=True);key.energy=keyE
