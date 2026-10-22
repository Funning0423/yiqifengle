import bpy,json,math,os
from mathutils import Vector
B='/workspace/wt-night/creator-build-project/assets/bundles/region_skycity/'
P=json.load(open('/workspace/b16night/poses.json'));A=P['A']
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=B+f);return [o for o in bpy.data.objects if o not in before]
city=imp('env_skycity.glb');soft=imp('env_sky_cloudsea_soft.glb');objs=city+soft;SOFTN=set(o.name for o in soft)
for o in objs:
  n=o.name
  if (n.startswith('state_') and not n.startswith('state_bridge_after')) or n.split('.')[0] in ('env_sky_cloudsea','env_sky_cumulus_far') or n.startswith('anchor_'):o.hide_render=True
def b(p):return Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=16;sc.render.resolution_x=390;sc.render.resolution_y=844;sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;nt=w.node_tree;bg=nt.nodes['Background']
# engine: ambient (skyIllum/colour) is NOT dimmed outdoors at night -> lighting rays always see the day ambient; camera sees the clear colour
amb=nt.nodes.new('ShaderNodeBackground');amb.inputs[0].default_value=(0.2*0.508,0.502*0.508,0.8*0.508,1);amb.inputs[1].default_value=1.0  # scene AmbientInfo skyColor x skyIllum 20000 x exposure(EV15)
lp=nt.nodes.new('ShaderNodeLightPath');mx=nt.nodes.new('ShaderNodeMixShader');out=nt.nodes['World Output']
nt.links.new(lp.outputs['Is Camera Ray'],mx.inputs[0]);nt.links.new(amb.outputs[0],mx.inputs[1]);nt.links.new(bg.outputs[0],mx.inputs[2]);nt.links.new(mx.outputs[0],out.inputs['Surface'])
key=bpy.data.lights.new('key','POINT');key.shadow_soft_size=30;ko=bpy.data.objects.new('key',key);sc.collection.objects.link(ko);ko.location=b((-25,80,25))
sun=bpy.data.lights.new('sun','SUN');so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so)
# WorldR5Integration.scene Main Light: euler(-30,-30,0), 125000 lux; camera f/16 1/125 ISO100 -> EV15, exposure 1/(1.2*2^15)
from mathutils import Quaternion
q=Quaternion((0.9330127018922194,-0.25,-0.25,-0.06698729810778066));dc=q@Vector((0,0,-1));dirb=Vector((dc.x,-dc.z,dc.y))
so.rotation_euler=dirb.to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL';cd.clip_end=3000;cd.clip_start=0.1
# split robot / soft-sea materials so they can take their own grade (engine grades per renderer)
for o in objs:
  if o.type!='MESH':continue
  tag='chr' if o.name.startswith('chr_') else ('sea' if o.name in SOFTN else None)
  if tag:
    for i,sl in enumerate(o.material_slots):
      if sl.material and sl.material.name.startswith('M_sky_palette') and not sl.material.name.startswith('M_sky_palette_emissive'):
        m2=sl.material.copy();m2.name=tag+'__'+sl.material.name;o.material_slots[i].material=m2
# albedo multiply node on every lit material
mul={}
for m in bpy.data.materials:
  if not m.use_nodes:continue
  p=[n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
  if not p:continue
  p=p[0];inp=p.inputs['Base Color'];mixn=m.node_tree.nodes.new('ShaderNodeMix');mixn.data_type='RGBA';mixn.blend_type='MULTIPLY';mixn.inputs['Factor'].default_value=1
  if inp.links:src=inp.links[0].from_socket;m.node_tree.links.remove(inp.links[0]);m.node_tree.links.new(src,mixn.inputs['A'])
  else:mixn.inputs['A'].default_value=inp.default_value
  m.node_tree.links.new(mixn.outputs['Result'],inp);mul[m.name]=mixn
# emissive materials as imported (emission strength)
em={}
for m in bpy.data.materials:
  if not m.use_nodes:continue
  for nd in m.node_tree.nodes:
    if nd.type=='BSDF_PRINCIPLED':em[m.name]=(nd,nd.inputs['Emission Strength'].default_value)
print('EMISSIVE',{k:v[1] for k,v in em.items()})
def srgb2lin(c):return [(x/255/12.92 if x/255<=0.04045 else ((x/255+0.055)/1.055)**2.4) for c_ in [0] for x in c]
EXPO=1/(1.2*2**15);SUN=125000*EXPO;KEY=0.2*4*math.pi*85**2  # board key SphereLight ~0.2 (exposed) at the court
def state(s):
  night=s!='day';after=s=='night_after'
  bg.inputs[0].default_value=(*srgb2lin((0,12,68) if night else (0x9c,0xca,0xdf)),1);bg.inputs[1].default_value=1.0
  # world ambient: same in all (engine only scales the main light at night)
  kc=[0xff,0xf3,0xda]
  if after:kc=[round(kc[i]*(180,198,232)[i]/255) for i in range(3)]
  key.color=srgb2lin(kc);key.energy=KEY*(0.35 if after else 1)
  # island main light: x0.35 + moon colour at night (WorldFlow, before and after)
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
      elif name.startswith(('M_sky_palette','M_sky_foliage','M_sky_cloud')):g=(.08,.10,.15)
    mixn.inputs['B'].default_value=(*g,1)
rim=b(A['anchor_cloudbridge_end']);court=b(A['anchor_starcourt_center']);d=(court-rim);d.z=0;d.normalize()
shots={'board':(b(P['board']['position']),b(P['board']['target']),P['board']['fovVerticalDeg']),
 'arrival':(rim-d*16+Vector((0,0,7)),court+Vector((0,0,2)),50)}
for st in ('day','night_before','night_after'):
  state(st)
  for n,(pos,tgt,fov) in shots.items():
    keyE=key.energy
    if n=='arrival':key.energy=0  # the journey city has no board key light
    cam.location=pos;cam.rotation_euler=(tgt-pos).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(fov)
    sc.render.filepath='/workspace/b16night/r4_%s_%s.png'%(n,st);bpy.ops.render.render(write_still=True);print('SHOT',n,st);key.energy=keyE
