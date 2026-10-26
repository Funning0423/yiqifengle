"""Renders of the delivered far_meadow_impostor / sea_reef_cluster glbs in the sail scene. Game sea texture (sea_waves_512, tiling ×3.2,
rough 1, metal 0), the island's own sky dome (unlit vertex colour, follows the camera), sun, no fog/volume.
blender -b --factory-startup -P render2.py -- <repo> <outdir> [ONLY=comma list]"""
import bpy,json,math,os,sys
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:];R,OUT=a[0].rstrip('/')+'/',a[1];os.makedirs(OUT,exist_ok=True)
BS=R+'creator-build-project/assets/bundles/transport_sail/';S=json.load(open('/tmp/sea2/shots.json'))
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
def b(p):return Vector((p[0],-p[2],p[1]))
def imp(f):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=f);return [o for o in bpy.data.objects if o not in before]
def roots(objs):return [o for o in objs if o.parent is None]
def base(o):return o.name.split('.')[0]
island=imp(R+'creator-project/assets/firstslice/combined_visual_m.glb')
dome=None
for o in island:
  n=o.name.lower()
  if base(o)=='env_sky_dome':dome=o
  elif o.type=='MESH' and any(k in n for k in ('sky','cloud_layer','sea_plane','ocean')):o.hide_render=True
meadow=imp(R+'creator-build-project/assets/bundles/region_meadow/env_meadow.glb')
for o in meadow:
  if base(o) in ('meadow_sky_dome','meadow_clouds_near'):o.hide_render=True
landing=imp(BS+'transit_landing.glb')
mroot=bpy.data.objects.new('meadow_root',None);sc.collection.objects.link(mroot)
for o in roots(meadow)+roots(landing):o.parent=mroot
mroot.location=b(S['root']);mroot.rotation_euler=(0,0,math.pi)
boat=imp(BS+'sailboat.glb');broot=bpy.data.objects.new('boat_root',None);sc.collection.objects.link(broot)
for o in roots(boat):o.parent=broot
for o in boat:
  if base(o)=='sail_furled':o.hide_render=True
props=imp(BS+'transit_sea_props.glb');far=imp(BS+'transit_far_cards.glb')
keep={'transit_pier','sea_rock_a','sea_rock_b','sea_rock_c','buoy_red','buoy_green'}
for o in props:
  if o.type=='MESH' and base(o) not in keep:o.hide_render=True
route=S['route'];start,end=route[0],route[-1];WY=-0.91
def place(name,objs,p):
  for o in objs:
    if base(o)==name:o.location=b(p)
place('transit_pier',props,[-1.9,-0.6,10.1-0.7]);place('buoy_red',props,[end[0]+5,WY,end[2]-8]);place('buoy_green',props,[end[0]-4.6,WY,end[2]-7.5])
place('sea_rock_a',props,[start[0]-8.2,WY,start[2]+4.2]);place('sea_rock_b',props,[start[0]+7.4,WY,start[2]+9.5]);place('sea_rock_c',props,[end[0]+10.5,WY,end[2]-9])
for o in far:
  if base(o) in ('far_island_lighthouse','far_meadow_coast'):o.hide_render=True
place('far_islet_a',far,[start[0]+70,WY,start[2]-120]);place('far_islet_b',far,[start[0]-90,WY,start[2]+40]);place('far_islet_c',far,[end[0]+80,WY,end[2]+30])
# ---- delivered assets, placed exactly like SailArt: stand-in world pos/scale/yaw; reefs at seaReefSlots, y = SAIL_SEA_Y, yaw = slot rad
st=S['standin'];imp_objs=imp(BS+'far_meadow_impostor.glb');iroot=bpy.data.objects.new('impostor_root',None);sc.collection.objects.link(iroot)
for o in roots(imp_objs):o.parent=iroot
iroot.location=b(st['pos']);iroot.scale=(st['scale'],)*3;iroot.rotation_euler=(0,0,math.radians(st['yawDeg']))
reef_objs=[]
for r in S['reefs']:
  objs=imp(BS+'sea_reef_cluster.glb');rr=bpy.data.objects.new('reef_root',None);sc.collection.objects.link(rr)
  for o in roots(objs):o.parent=rr
  rr.location=b(r['pos']);rr.rotation_euler=(0,0,r['yaw']);reef_objs+=objs
# ---- sea: the game's sea_plane material (sea_waves_512, tilingOffset ×3.2), 1:1 with SailArt (roughness 1, metallic 0)
seaobjs=imp(BS+'transit_sea.glb')
for o in seaobjs:
  if o.type=='MESH' and base(o)!='sea_plane':o.hide_render=True
sp=[o for o in seaobjs if base(o)=='sea_plane'][0];sp.parent=None
for m in sp.data.materials:
  nt=m.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=1;p.inputs['Metallic'].default_value=0
  for n in nt.nodes:
    if n.type=='TEX_IMAGE':
      mp=nt.nodes.new('ShaderNodeMapping');tc=nt.nodes.new('ShaderNodeTexCoord');mp.inputs['Scale'].default_value=(3.2,3.2,1);nt.links.new(tc.outputs['UV'],mp.inputs[0]);nt.links.new(mp.outputs[0],n.inputs['Vector'])
      n.interpolation='Linear';n.extension='REPEAT'
sun=bpy.data.lights.new('sun','SUN');sun.energy=3.0;sun.color=(1,0.96,0.88);sun.angle=math.radians(2);so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so)
so.rotation_euler=(math.radians(50),0,math.radians(150))
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(0.45,0.66,0.86,1);w.node_tree.nodes['Background'].inputs[1].default_value=0.6
sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=32;sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL';cd.clip_end=1400;cd.clip_start=0.3
meadow_all=[o for o in meadow+landing if o.type=='MESH' and not o.hide_render]
# plan E lowland: world z<45 verts of terrain, river_bank AND river (运镜bot: river sheet sits 0.13 m above the sea) to y -1.3, as shape keys
bpy.context.view_layer.update();sinkkeys=[]
for o in meadow:
  if o.type!='MESH' or base(o) not in ('meadow_terrain','meadow_river_bank','meadow_river'):continue
  o.shape_key_add(name='Basis');k=o.shape_key_add(name='sunk');mw=o.matrix_world;inv=mw.inverted()
  for i,v in enumerate(o.data.vertices):
    wv=mw@v.co
    if -wv.y<45 and wv.z>-1.3:wv.z=-1.3;k.data[i].co=inv@wv
  sinkkeys.append(k)
def set_state(after,real=False):
  for k in sinkkeys:k.value=1.0 if after else 0.0
  for o in imp_objs+reef_objs:
    if o.type=='MESH':o.hide_render=not after
  for o in meadow_all:o.hide_render=after and not real
  if real:
    for o in imp_objs:o.hide_render=True
def setcam(c,bt):
  pos,tgt=b(c['position']),b(c['target']);cam.location=pos;cam.rotation_euler=(tgt-pos).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(c['fovVerticalDeg'])
  broot.location=b(bt['pos']);broot.rotation_euler=(0,bt['roll'],bt['yaw'])
  sp.location=(pos.x,pos.y,b([0,WY,0]).z);sp.scale=(3.2,3.2,3.2)
  if dome:dome.location=(pos.x,pos.y,dome.location.z)
ONLY=os.environ.get('ONLY')
plan=[('swap',('before','after'),(390,844)),('river',('before','after'),(780,844)),('pier',('before','after'),(390,844)),('dock',('before','after'),(390,844)),('mid',('before','after'),(390,844)),('reef_close',('after',),(780,844)),('reef_water',('after',),(780,844)),('imp_close',('after',),(780,844)),('imp_shore',('after',),(780,844)),('pier_small',('after',),(390,520)),('pier_320',('after',),(320,568))]
for k,states,(rw,rh) in plan:
  if ONLY and k not in ONLY.split(','):continue
  key='pier' if k.startswith('pier') else k;v=S['cams'][key]
  for stt in [x for x in states if not (os.environ.get('AFTER_ONLY') and x=='before')]:
    sc.render.resolution_x,sc.render.resolution_y=rw,rh
    set_state(stt=='after',real=k in('swap','river'));setcam(v['cam'],v['boat'])
    sc.render.filepath=f'{OUT}/{k}_{stt}.png';bpy.ops.render.render(write_still=True);print('SHOT',k,stt,flush=True)
