import bpy,json,math,os
from mathutils import Vector
B='/workspace/wt-night/creator-build-project/assets/bundles/region_skycity/'
P=json.load(open('/workspace/b16night/poses.json'));A=P['A']
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=B+f);return [o for o in bpy.data.objects if o not in before]
objs=imp('env_skycity.glb')+imp('env_sky_cloudsea_soft.glb')
for o in objs:
  n=o.name
  if (n.startswith('state_') and not n.startswith('state_bridge_after')) or n.split('.')[0] in ('env_sky_cloudsea','env_sky_cumulus_far') or n.startswith('anchor_'):o.hide_render=True
def b(p):return Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=16;sc.render.resolution_x=390;sc.render.resolution_y=844;sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background']
key=bpy.data.lights.new('key','POINT');key.shadow_soft_size=30;ko=bpy.data.objects.new('key',key);sc.collection.objects.link(ko);ko.location=b((-25,80,25))
sun=bpy.data.lights.new('sun','SUN');so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so);so.rotation_euler=(math.radians(50),0,math.radians(35))
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL';cd.clip_end=3000;cd.clip_start=0.1
# emissive materials as imported (emission strength)
em={}
for m in bpy.data.materials:
  if not m.use_nodes:continue
  for nd in m.node_tree.nodes:
    if nd.type=='BSDF_PRINCIPLED':em[m.name]=(nd,nd.inputs['Emission Strength'].default_value)
print('EMISSIVE',{k:v[1] for k,v in em.items()})
def srgb2lin(c):return [(x/255/12.92 if x/255<=0.04045 else ((x/255+0.055)/1.055)**2.4) for c_ in [0] for x in c]
KEY=1.0e6;SUN=2.2
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
rim=b(A['anchor_cloudbridge_end']);court=b(A['anchor_starcourt_center']);d=(court-rim);d.z=0;d.normalize()
shots={'board':(b(P['board']['position']),b(P['board']['target']),P['board']['fovVerticalDeg']),
 'arrival':(rim-d*16+Vector((0,0,7)),court+Vector((0,0,2)),50)}
for st in ('day','night_before','night_after'):
  state(st)
  for n,(pos,tgt,fov) in shots.items():
    cam.location=pos;cam.rotation_euler=(tgt-pos).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(fov)
    sc.render.filepath='/workspace/b16night/%s_%s.png'%(n,st);bpy.ops.render.render(write_still=True);print('SHOT',n,st)
