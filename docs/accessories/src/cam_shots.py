# v3c 游戏机位截图：白天/夜间(lantern.core 暖橙点光) + 穿插三角可见性 mask（Workbench 平光，无 AA）
# blender -b --python cam_shots.py -- char.glb shots.json outdir
import bpy,sys,os,json,math,numpy as np
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
glb,shotsp,out=sys.argv[-3:];os.makedirs(out,exist_ok=True);os.environ['CHARGLB']=glb;os.environ['LMODE']='hinge';os.environ.setdefault('SOCK','[0.0138,0.0803,0.0073]')
CFG=json.load(open(shotsp));RX,RY=CFG['res']
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if o.name.startswith('Icosphere'): o.hide_render=True
O={o.name:o for o in bpy.data.objects};arm=[o for o in O.values() if o.type=='ARMATURE'][0];B=O['LOD0_G2_BODY']
for t in arm.animation_data.nla_tracks: t.mute=True
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lantern_attach.py')).read())
LOBJ=attach_lantern(arm,CFG['lantern']);LM=[o for o in LOBJ if o.type=='MESH'];CORE=[o for o in LM if o.name.startswith('lantern.core')][0]
BAD=set(CFG['bad_polys'])
# 地面
bpy.ops.mesh.primitive_plane_add(size=30);GND=bpy.context.object;gm=bpy.data.materials.new('gnd');gm.use_nodes=True;gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.35,0.33,0.30,1);GND.data.materials.append(gm)
PLAT=None
if CFG.get('platform'):
    p=CFG['platform'];bpy.ops.mesh.primitive_cube_add(size=1);PLAT=bpy.context.object;PLAT.scale=(p['sx'],p['sz'],p['h']);PLAT.location=(p['cx'],-p['cz'],p['h']/2)
    pm=bpy.data.materials.new('plat');pm.use_nodes=True;pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.45,0.36,0.26,1);PLAT.data.materials.append(pm)
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL'
sc.render.resolution_x=RX;sc.render.resolution_y=RY;sc.render.resolution_percentage=100
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));sc.collection.objects.link(sun);sun.rotation_euler=(math.radians(50),0,math.radians(-30));sun.data.energy=3.5
pl=bpy.data.objects.new('pl',bpy.data.lights.new('pl','POINT'));sc.collection.objects.link(pl);pl.data.color=(1.0,0.55,0.2);pl.data.energy=12;pl.data.shadow_soft_size=0.02
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background']
def setpose(clip,f,hold):
    a=sorted([x for x in bpy.data.actions if x.name==clip or x.name.startswith(clip+'_')],key=lambda a:len(a.name))[0]
    arm.animation_data.action=a
    try: arm.animation_data.action_slot=a.slots[0]
    except Exception: pass
    sc.frame_set(int(a.frame_range[0])+f)
    for o in bpy.data.objects:
        if o.type=='MESH' and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]: kb.value=hold if kb.name=='lantern_hold_R' else 0
    bpy.context.view_layer.update();place_lantern(arm);bpy.context.view_layer.update()
def setcam(s):
    tg=Vector(s['target']) if 'target' in s else None
    if s.get('target_hand'): tg=Vector(np.array(socket_world(arm)[1]))
    hz=(arm.matrix_world@arm.pose.bones['hips'].matrix).to_3x3()@Vector((0,0,1));  # 她的前方 = 骨骼局部（glTF +Z）
    root=arm.matrix_world.translation
    az=math.radians(s['az']);f=Vector((0,-1,0));r=Vector((-1,0,0));d=f*math.cos(az)+r*math.sin(az)
    pt=math.radians(s['pitch']);pos=tg+(d*math.cos(pt)+Vector((0,0,math.sin(pt))))*s['dist']
    if 'cam_z' in s: pos.z=s['cam_z']
    cam.location=pos;cam.rotation_euler=(tg-pos).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(s['fov'])
def day():
    sc.render.engine='BLENDER_EEVEE_NEXT';sun.hide_render=False;sun.data.energy=3.5;pl.hide_render=True;bg.inputs[0].default_value=(0.55,0.68,0.85,1);bg.inputs[1].default_value=0.9
def night():
    sc.render.engine='BLENDER_EEVEE_NEXT';sun.hide_render=False;sun.data.energy=0.06;sun.data.color=(0.6,0.7,1.0);pl.hide_render=False;pl.location=CORE.matrix_world.translation;bg.inputs[0].default_value=(0.02,0.03,0.06,1);bg.inputs[1].default_value=0.3
# mask 材质
def mk(n,c): m=bpy.data.materials.new(n);m.diffuse_color=c;return m
MK=mk('mk_k',(0,0,0,1));MM=mk('mk_m',(1,0,1,1));MG=mk('mk_g',(0,1,0,1))
def mask(path):
    sc.render.engine='BLENDER_WORKBENCH';sh=sc.display.shading;sh.light='FLAT';sh.color_type='MATERIAL';sh.show_cavity=False;sh.show_shadows=False;sc.display.render_aa='OFF';sh.background_type='VIEWPORT' if hasattr(sh,'background_type') else None
    sc.world.color=(0,0,0)
    saved={}
    for o in [x for x in bpy.data.objects if x.type=='MESH' and not x.hide_render]:
        saved[o.name]=([m for m in o.data.materials],[p.material_index for p in o.data.polygons])
        o.data.materials.clear();o.data.materials.append(MK);o.data.materials.append(MM);o.data.materials.append(MG)
        idx=[0]*len(o.data.polygons)
        if o==B:
            for pi in BAD: idx[pi]=1
        elif o in LM and o.name.startswith('lantern.body'):
            Mi=LROOT.matrix_world.inverted()
            for p in o.data.polygons:
                q=[Mi@(o.matrix_world@o.data.vertices[v].co) for v in p.vertices]
                if min(x.z for x in q)>-0.0061 and max(abs(x.x) for x in q)<0.0075: idx[p.index]=2
        o.data.polygons.foreach_set('material_index',idx)
    sc.render.filepath=path;bpy.ops.render.render(write_still=True)
    for n,(ms,ix) in saved.items():
        o=bpy.data.objects[n];o.data.materials.clear()
        for m in ms: o.data.materials.append(m)
        o.data.polygons.foreach_set('material_index',ix)
sc.eevee.taa_render_samples=16
res=[]
for s in CFG['shots']:
    setpose(s['clip'],s['f'],s.get('hold',1.0))
    if PLAT: PLAT.hide_render=not s.get('platform',False)
    setcam(s);n=s['name']
    hp=world_to_camera_view(sc,cam,Vector(socket_world(arm)[1]))
    mask(f'{out}/{n}_mask.png')
    for tod,fn in (('day',day),('night',night)):
        fn();sc.render.filepath=f'{out}/{n}_{tod}.png';bpy.ops.render.render(write_still=True)
    res.append(dict(name=n,hand_px=[hp.x*RX,(1-hp.y)*RY],shot=s));print('SHOT',n,flush=True)
json.dump(res,open(f'{out}/shots_{os.path.basename(shotsp)}','w'),indent=1)
