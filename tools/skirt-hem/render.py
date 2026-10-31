import bpy,sys,json,math
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
a=sys.argv[sys.argv.index('--')+1:]; glb,meta,outdir=a[:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
M=json.load(open(meta)); sc=bpy.context.scene; FPS=sc.render.fps
for o in list(bpy.data.objects):
    if o.name=='Icosphere': o.hide_render=True
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for o in bpy.data.objects:
    if o.type=='MESH' and o.data.shape_keys: o.data.shape_keys.animation_data_clear()
def pw(c,t):
    if t<=c[0][0]: return c[0][1]
    for (x,va),(y,vb) in zip(c,c[1:]):
        if t<=y: return va+(vb-va)*(t-x)/max(y-x,1e-9)
    return c[-1][1]
sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.cycles.device='CPU'
sc.render.resolution_x=640; sc.render.resolution_y=800
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=1.0
w.node_tree.nodes['Background'].inputs[0].default_value=(0.8,0.85,0.9,1)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN')); sun.data.energy=3; sun.rotation_euler=(math.radians(50),0,math.radians(-30)); sc.collection.objects.link(sun)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.lens=50
acts={x.name.replace('_R5G2_RIG_22P4',''):x for x in bpy.data.actions}
jobs=json.loads(a[3]); info=[]
for clip,t,tag in jobs:
    if clip=='rest':
        arm.animation_data.action=None
        for pb in arm.pose.bones: pb.matrix_basis=Matrix()
        curves={}
    else:
        arm.animation_data.action=acts[clip]; curves=(M['clips'].get(clip,{}).get('morph') or {}).get('curves',{})
    for o in bpy.data.objects:
        if o.type=='MESH' and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]: kb.value=min(1,max(0,pw(curves[kb.name],t))) if kb.name in curves else 0
    sc.frame_set(int(t*FPS),subframe=(t*FPS)%1)
    hips=arm.matrix_world@arm.pose.bones['hips'].head
    R=(arm.matrix_world@arm.pose.bones['hips'].matrix).to_3x3()@(arm.data.bones['hips'].matrix_local).to_3x3().inverted()
    f=R@Vector((0,-1,0)); f.z=0; f.normalize(); side=Vector((-f.y,f.x,0))
    kz=((arm.matrix_world@arm.pose.bones['shin.L'].head).z+(arm.matrix_world@arm.pose.bones['shin.R'].head).z)/2
    tgt=Vector((hips.x,hips.y,kz+0.05))
    for view,d in (('front',f),('34',(f+side*0.9).normalized())):
        cam.location=tgt+d*2.6+Vector((0,0,0.15)); cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
        fn=f'{outdir}/{tag}_{view}.png'; sc.render.filepath=fn; bpy.ops.render.render(write_still=True)
        def px(p):
            c=world_to_camera_view(sc,cam,p); return [c.x*640,(1-c.y)*800]
        kL=arm.matrix_world@arm.pose.bones['shin.L'].head; kR=arm.matrix_world@arm.pose.bones['shin.R'].head
        info.append({'file':fn,'kneeL':px(kL),'kneeR':px(kR)})
json.dump(info,open(outdir+'/_proj.json','w'))
