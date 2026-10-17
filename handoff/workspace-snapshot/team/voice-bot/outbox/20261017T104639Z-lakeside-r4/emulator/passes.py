# Voice Bot: Blender G-buffer for a Cocos-3.8.8 shading emulator (no lighting in Blender; numpy does the Cocos math).
import bpy, json, math, sys, os
from mathutils import Vector, Quaternion, Matrix
argv=sys.argv[sys.argv.index('--')+1:]; M=argv[0]; TR=argv[1]; OUT=argv[2]; POSE=json.loads(argv[3]); MODE=argv[4] if len(argv)>4 else 'runtime'
S=json.load(open(TR))
SKIP={'LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb'}
def runtime(i): return i['glb'] not in SKIP and not i['glb'].startswith('LK_piece_') and i['name']!=i['glb'][:-4]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
cache={}
def src(glb):
    if glb in cache: return cache[glb]
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(M,glb))
    objs=[o for o in bpy.data.objects if o not in before]
    for o in objs: o.hide_render=True; o.hide_viewport=True
    cache[glb]=[o for o in objs if o.type=='MESH']; return cache[glb]
IDS={}
def oid(glb):
    if glb not in IDS: IDS[glb]=len(IDS)+1
    return IDS[glb]
n=0
for i in S['instances']:
    if MODE=='runtime' and not runtime(i): continue
    for m in src(i['glb']):
        o=bpy.data.objects.new(i['name'],m.data); sc.collection.objects.link(o)
        x,y,z=i['pos']; qx,qy,qz,qw=i['rot_quat_xyzw']; sx,sy,sz=i['scale']
        q=Quaternion((qw,qx,-qz,qy)); o.matrix_world=Matrix.Translation((x,-z,y))@q.to_matrix().to_4x4()@Matrix.Diagonal((sx,sz,sy,1))@m.matrix_world
        o.pass_index=oid(i['glb']); n+=1
print('PLACED',n)
vl=sc.view_layers[0]
for nm,t in (('alb','COLOR'),('vc','COLOR'),('nrm','COLOR'),('pos','COLOR')):
    a=vl.aovs.add(); a.name=nm; a.type=t
vl.use_pass_object_index=True
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    nt=mat.node_tree; N=nt.nodes; L=nt.links
    b=[x for x in N if x.bl_idname=='ShaderNodeBsdfPrincipled']
    tex=None
    if b and b[0].inputs['Base Color'].links:
        s=b[0].inputs['Base Color'].links[0].from_node
        # find image texture upstream
        stack=[s]
        while stack:
            k=stack.pop()
            if k.bl_idname=='ShaderNodeTexImage': tex=k; break
            for inp in k.inputs:
                for l in inp.links: stack.append(l.from_node)
    ca=N.new('ShaderNodeVertexColor'); ca.layer_name=''
    attr=N.new('ShaderNodeAttribute'); attr.attribute_name='Color'; attr.attribute_type='GEOMETRY'
    g=N.new('ShaderNodeNewGeometry')
    def aov(name,sock):
        o=N.new('ShaderNodeOutputAOV'); o.aov_name=name; L.new(sock,o.inputs['Color'])
    if tex: 
        tex.interpolation='Closest'; aov('alb',tex.outputs['Color'])
    aov('vc',attr.outputs['Color'])
    # Cocos Y-up normal / position: (x, z, -y)
    for nm,sock in (('nrm',g.outputs['Normal']),('pos',g.outputs['Position'])):
        sp=N.new('ShaderNodeSeparateXYZ'); L.new(sock,sp.inputs[0]); cb=N.new('ShaderNodeCombineXYZ')
        L.new(sp.outputs['X'],cb.inputs['X']); L.new(sp.outputs['Z'],cb.inputs['Y']); ng=N.new('ShaderNodeMath'); ng.operation='MULTIPLY'; ng.inputs[1].default_value=-1; L.new(sp.outputs['Y'],ng.inputs[0]); L.new(ng.outputs[0],cb.inputs['Z'])
        aov(nm,cb.outputs[0])
    if b: b[0].inputs['Alpha'].default_value=1.0
    mat.blend_method='OPAQUE' if hasattr(mat,'blend_method') else None
cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
px,py,pz=POSE['position']; co.location=(px,-pz,py)
qx,qy,qz,qw=POSE['rotation']; co.rotation_mode='QUATERNION'; co.rotation_quaternion=Quaternion((1,0,0),math.radians(90))@Quaternion((qw,qx,qy,qz))
cam.sensor_fit='VERTICAL'; cam.angle_y=math.radians(POSE['fovVerticalDeg']); cam.clip_start=.1; cam.clip_end=1000
sc.render.engine='CYCLES'; sc.cycles.samples=1; sc.cycles.use_denoising=False; sc.cycles.pixel_filter_type='BOX'; sc.render.filter_size=0.01
sc.cycles.max_bounces=0; sc.cycles.seed=0
sc.render.resolution_x=POSE.get('w',720); sc.render.resolution_y=POSE.get('h',1280); sc.render.resolution_percentage=100
sc.render.image_settings.media_type='MULTI_LAYER_IMAGE'; sc.render.image_settings.file_format='OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth='32'
sc.view_settings.view_transform='Standard'
sc.render.filepath=OUT
w=bpy.data.worlds.new('w'); sc.world=w
bpy.ops.render.render(write_still=True)
json.dump(IDS,open(OUT+'.ids.json','w'))
print('IDS',IDS)
