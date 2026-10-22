# 提灯走路预览：walk_loop 上她的右臂(upper_arm.L/forearm.L)摆动绕周期平均姿态按 SWING 缩放（hand.L 不动 → 不扭腕），叠 lantern_hold_R 形变，挂 prop_lantern_v1（钟摆静止竖直位）
# blender -b --python lantern_walk_preview.py -- char.glb lantern_prop.glb delta.npz outdir
import bpy,sys,os,json,math,numpy as np
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
from mathutils import Vector,Quaternion
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
GLB,PROP,NPZ,OUT=sys.argv[-4:];os.makedirs(OUT,exist_ok=True);os.environ['CHARGLB']=GLB
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30;bpy.ops.import_scene.gltf(filepath=GLB)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0];PB=arm.pose.bones
exec(open('/workspace/yiqifengle/previews/角色建模bot/accessories/src/lantern_attach.py').read())
LOBJ=attach_lantern(arm,PROP)
J,Bn=load(GLB);m=[x for x in J['meshes'] if x['name']=='LOD0_G2_BODY'][0];Z=np.load(NPZ)
allP=np.concatenate([acc(J,Bn,p['attributes']['POSITION']) for p in m['primitives']]);allD=np.concatenate([Z['prim%d'%i] if 'prim%d'%i in Z else np.zeros_like(acc(J,Bn,p['attributes']['POSITION'])) for i,p in enumerate(m['primitives'])])
Bo=bpy.data.objects['LOD0_G2_BODY'];kd=KDTree(len(allP))
for i,x in enumerate(allP):kd.insert(Vector((x[0],-x[2],x[1])),i)
kd.balance();Bo.data.shape_keys or Bo.shape_key_add(name='Basis');kb=Bo.shape_key_add(name='lantern_hold_R')
for v in Bo.data.vertices:
    co,i,d=kd.find(v.co);dd=allD[i];kb.data[v.index].co=v.co+Vector((dd[0],-dd[2],dd[1]))
kb.value=1
act=[a for a in bpy.data.actions if a.name.startswith('walk_loop')];act=sorted(act,key=lambda a:len(a.name))[0];arm.animation_data.action=act
try:arm.animation_data.action_slot=act.slots[0]
except Exception:pass
f0,f1=act.frame_range;N=43
ARMB=['upper_arm.L','forearm.L']
def raw(f):
    fr=f0+(f1-f0)*f/N;sc.frame_set(int(fr),subframe=fr-int(fr));return {b:PB[b].rotation_quaternion.copy() for b in ARMB}
R=[raw(f) for f in range(N)]
mean={}
for b in ARMB:
    q=np.array([list(r[b]) for r in R]);q*=np.sign(q@q[0])[:,None];mq=q.mean(0);mean[b]=Quaternion(mq/np.linalg.norm(mq))
def amp(s):   # 手腕(hand.L 头)前后摆幅 m
    xs=[]
    for f in range(N):
        pose_at(f,s);xs.append((arm.matrix_world@PB['hand.L'].head).copy())
    X=np.array([list(x) for x in xs]);return float(np.ptp(X[:,1])),float(np.ptp(X[:,0]))
def pose_at(f,s):
    fr=f0+(f1-f0)*f/N;sc.frame_set(int(fr),subframe=fr-int(fr))
    for b in ARMB:PB[b].rotation_quaternion=mean[b].slerp(R[f][b],s)
    bpy.context.view_layer.update()
sc.render.engine='BLENDER_WORKBENCH';sh=sc.display.shading;sh.show_cavity=True;sh.color_type='OBJECT'
for o in bpy.data.objects:
    if o.type=='MESH':o.color=(0.8,0.78,0.72,1)
for o in LOBJ:
    if o.type=='MESH':o.color=(0.75,0.5,0.2,1)
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.angle=math.radians(30);cd.clip_start=0.01
sc.render.resolution_x=360;sc.render.resolution_y=480
H=(arm.matrix_world@PB['hips'].head).copy()
info={}
gi={g.index:g.name for g in Bo.vertex_groups}
for s in json.loads(os.environ.get('SW','[1.0,0.65]')):
    a=amp(s);info['swing_%.2f'%s]=dict(wrist_fore_aft_m=round(a[0],3),wrist_lateral_m=round(a[1],3))
    for f in range(N):
        pose_at(f,s);place_lantern(arm);bpy.context.view_layer.update()
        for k,(loc,look) in enumerate([(Vector((-1.6,-1.6,1.1)),Vector((0,0,0.85))),(Vector((-2.2,0,1.0)),Vector((0,0,0.85)))]):
            cam.location=H.xy.to_3d()+loc;cam.rotation_euler=(H.xy.to_3d()+look-cam.location).to_track_quat('-Z','Y').to_euler()
            sc.render.filepath=OUT+'/f_%.2f_v%d_%03d.png'%(s,k,f);bpy.ops.render.render(write_still=True)
json.dump(info,open(OUT+'/swing.json','w'),indent=1);print('INFO',json.dumps(info))
