# Voice Bot r4: re-render r5h3 (blend as-is: EEVEE, AgX Punchy, exposure 0.32, same lights/materials/world) through the ENGINE board
# background camera. Only the objects the engine's lease draws are rendered (runtime list = lakesideSceneInstances(transforms)).
# blender -b lakeside_r5h3.blend -P render_ref.py -- <pose.json> <w> <h> <outprefix> <frames comma> [samples]
import bpy, sys, json, math, os
from mathutils import Quaternion
a=sys.argv[sys.argv.index('--')+1:]; P=json.load(open(a[0])); W,H=int(a[1]),int(a[2]); OUT=a[3]; FR=[int(x) for x in a[4].split(',')]
sc=bpy.context.scene
if len(a)>5: sc.eevee.taa_render_samples=int(a[5])
TR=json.load(open('/tmp/wt-vb-r4/creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json'))['instances']
SKIP={'LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb'}
keep={i['name'] for i in TR if i['glb'] not in SKIP and not i['glb'].startswith('LK_piece_') and i['name']!=i['glb'][:-4]}
hidden=[];shown=0
for o in sc.objects:
  if o.type not in ('MESH','CURVE','FONT','SURFACE','META'): continue
  if o.name in keep: shown+=1; continue
  if not o.hide_render: hidden.append(o.name); o.hide_render=True
missing=sorted(keep-{o.name for o in sc.objects})
print('REF shown',shown,'hidden',len(hidden),'missing',len(missing),missing[:10])
cd=bpy.data.cameras.new('CAM_engine'); co=bpy.data.objects.new('CAM_engine',cd); sc.collection.objects.link(co); sc.camera=co
px,py,pz=P['position']; co.location=(px,-pz,py)
qx,qy,qz,qw=P['rotation']; co.rotation_mode='QUATERNION'; co.rotation_quaternion=Quaternion((1,0,0),math.radians(90))@Quaternion((qw,qx,qy,qz))
cd.sensor_fit='VERTICAL'; cd.angle_y=math.radians(P['fovVerticalDeg']); cd.clip_start=0.1; cd.clip_end=1000
sc.render.resolution_x=W; sc.render.resolution_y=H; sc.render.resolution_percentage=100
json.dump(dict(shown=shown,hidden=hidden,missing=missing),open(OUT+'objects.json','w'),indent=0)
for f in FR:
  sc.frame_set(f); sc.render.filepath=OUT+'f_%04d.png'%f; bpy.ops.render.render(write_still=True); print('FRAME',f,flush=True)
