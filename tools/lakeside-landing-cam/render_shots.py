# Blender 4.5: render the skycity → lakeside balloon keyframes offline (运镜bot r5 lakeside-landing-cam).
# blender -b -P render_shots.py -- shots.json outdir
# shots.json: {scene:{lakeYawDeg,lakeRoot,skyYawDeg,skyOff,repo}, shots:[{name,res:[w,h],cam:{position,target,fov},vehicle:[x,y,z]|null,girl:{pos,yawRad}|null,ortho:null|scale}]}
# All coordinates in the journey world (glTF Y-up metres); converted here to Blender Z-up.
import bpy, json, sys, math, os
from mathutils import Matrix, Vector
argv=sys.argv[sys.argv.index('--')+1:];J=json.load(open(argv[0]));OUT=argv[1];os.makedirs(OUT,exist_ok=True)
S=J['scene'];REPO=S['repo'];B=REPO+'/creator-build-project/assets/bundles/'
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
def g2b(p):return Vector((p[0],-p[2],p[1]))
def ry(deg):t=math.radians(deg);c,s=math.cos(t),math.sin(t);return Matrix(((c,0,s,0),(0,1,0,0),(-s,0,c,0),(0,0,0,1)))
def tr(v):m=Matrix.Identity(4);m.translation=Vector(v);return m
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
def imp(path):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=path);return [o for o in bpy.data.objects if o not in before]
def roots(objs):return [o for o in objs if o.parent is None or o.parent not in objs]
# lakeside instances
T=json.load(open(B+'region_lakeside/scene_r5h_slim_transforms.json'))
SKIP=('LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb')
lib={};lake=tr(S['lakeRoot'])@ry(S['lakeYawDeg'])
hold=bpy.data.collections.new('lib');sc.collection.children.link(hold)
for ins in T['instances']:
    g=ins.get('glb')
    if not isinstance(g,str) or g in SKIP or g.startswith('LK_piece_') or ins.get('name')==g.replace('.glb',''):continue
    if g not in lib:
        objs=imp(B+'region_lakeside/models/'+g)
        meshes=[o for o in objs if o.type=='MESH']
        for o in objs:
            for c in list(o.users_collection):c.objects.unlink(o)
            hold.objects.link(o)
        lib[g]=[(o.data,o.matrix_world.copy(),[m for m in o.material_slots]) for o in meshes]
    x,y,z,w=ins['rot_quat_xyzw'];from mathutils import Quaternion
    q=Quaternion((w,x,y,z)).to_matrix().to_4x4();sx,sy,sz=ins['scale'];Sm=Matrix.Diagonal((sx,sy,sz,1))
    M=lake@tr(ins['pos'])@q@Sm
    for data,mw,_ in lib[g]:
        o=bpy.data.objects.new(ins['name'],data);sc.collection.objects.link(o);o.matrix_world=C@M@Ci@mw
hold.hide_render=True;hold.hide_viewport=True
# skycity
HIDE=('cloudsea','cumulus_far','cloud_small','Icosphere','_after')
objs=imp(B+'region_skycity/env_skycity.glb');emp=bpy.data.objects.new('sky_root',None);sc.collection.objects.link(emp)
for o in roots(objs):o.parent=emp
emp.matrix_world=C@tr(S['skyOff'])@ry(S['skyYawDeg'])@Ci
for o in objs:
    if any(h in o.name for h in HIDE):o.hide_render=True
# balloon + girl
bal=imp(B+'region_transit_balloon/transport_balloon.glb');balE=bpy.data.objects.new('bal_root',None);sc.collection.objects.link(balE)
for o in roots(bal):o.parent=balE
gl=imp(B+'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');girlE=bpy.data.objects.new('girl_root',None);sc.collection.objects.link(girlE)
for o in roots(gl):o.parent=girlE
# light + world
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));sc.collection.objects.link(sun);sun.data.energy=3.2;sun.rotation_euler=(math.radians(50),0,math.radians(35));sun.data.color=(1,.96,.9)
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background'];bg.inputs[0].default_value=(.55,.72,.92,1);bg.inputs[1].default_value=.9
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.view_settings.view_transform='Standard'
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.clip_start=.05;cam.data.clip_end=3000
for sh in J['shots']:
    w_,h_=sh['res'];sc.render.resolution_x=w_;sc.render.resolution_y=h_;sc.render.resolution_percentage=100
    p=g2b(sh['cam']['position']);t=g2b(sh['cam']['target']);cam.location=p
    d=(t-p).normalized();cam.rotation_mode='QUATERNION';cam.rotation_quaternion=d.to_track_quat('-Z','Y')
    if sh.get('ortho'):cam.data.type='ORTHO';cam.data.ortho_scale=sh['ortho']
    else:cam.data.type='PERSP';cam.data.angle=math.radians(sh['cam']['fov'])
    v=sh.get('vehicle');balE.hide_render=v is None
    for o in bal:o.hide_render=v is None
    if v is not None:balE.location=g2b(v)
    gi=sh.get('girl')
    for o in gl:o.hide_render=gi is None
    if gi:girlE.location=g2b(gi['pos']);girlE.rotation_euler=(0,0,gi.get('yawRad',0))
    sc.render.filepath=os.path.join(OUT,sh['name']+'.png');bpy.ops.render.render(write_still=True);print('RENDERED',sh['name'])
