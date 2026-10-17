import bpy, json, math, sys
from mathutils import Vector, Quaternion
argv=sys.argv[sys.argv.index('--')+1:]; mode,outp=argv[0],argv[1]
S=json.load(open('/tmp/lk/render/scene.json'))
M='/tmp/wt-lake/creator-build-project/assets/bundles/region_lakeside/models/'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
cache={}
def src(glb):
    if glb in cache: return cache[glb]
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=M+glb)
    objs=[o for o in bpy.data.objects if o not in before]
    for o in objs: o.hide_render=True; o.hide_viewport=True
    cache[glb]=[o for o in objs if o.type=='MESH']; return cache[glb]
for i in S['instances']:
    meshes=src(i['glb'])
    x,y,z=i['pos']; qx,qy,qz,qw=i['rot_quat_xyzw']; sx,sy,sz=i['scale']
    for m in meshes:
        o=bpy.data.objects.new(i['name'],m.data); sc.collection.objects.link(o)
        q=Quaternion((qw,qx,-qz,qy)); base=m.matrix_world.copy()
        from mathutils import Matrix
        T=Matrix.Translation((x,-z,y))@q.to_matrix().to_4x4()@Matrix.Diagonal((sx,sz,sy,1))
        o.matrix_world=T@base
# grid overlay (2D board cell outlines) in board mode
if mode=='grid':
    mat=bpy.data.materials.new('grid');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(1,1,.85,1);e.inputs[1].default_value=3;o_=n.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(e.outputs[0],o_.inputs[0])
    chime=bpy.data.materials.new('chime');chime.use_nodes=True;n=chime.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(1,.7,.2,1);e.inputs[1].default_value=4;o_=n.new('ShaderNodeOutputMaterial');chime.node_tree.links.new(e.outputs[0],o_.inputs[0])
    for k,(cx,cy,cz) in enumerate(S['grid']):
        bpy.ops.mesh.primitive_plane_add(size=1.0,location=(cx,-cz,0.06))
        p=bpy.context.object; bpy.ops.object.modifier_add(type='WIREFRAME'); p.modifiers[-1].thickness=0.04
        p.data.materials.append(chime if k in S['chimes'] else mat)
pose=S['poses']['tall' if mode=='tall' else 'ref']
cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
px,py,pz=pose['position']; co.location=(px,-pz,py)
qx,qy,qz,qw=pose['rotation']; co.rotation_mode='QUATERNION'; co.rotation_quaternion=Quaternion((1,0,0),math.radians(90))@Quaternion((qw,qx,qy,qz))
cam.sensor_fit='VERTICAL'; cam.angle_y=math.radians(pose['fovVerticalDeg']); cam.clip_start=.1; cam.clip_end=1000
for l in S['lights']:
    ld=bpy.data.lights.new(l['name'],'SUN'); ld.energy=7.2*l['ratio']; ld.color=l['colorLinear']; lo=bpy.data.objects.new(l['name'],ld); sc.collection.objects.link(lo)
    fx,fy,fz=l['forward']; d=Vector((fx,-fz,fy)); lo.rotation_mode='QUATERNION'; lo.rotation_quaternion=d.to_track_quat('-Z','Y')
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; h=S['clear'].lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
w.node_tree.nodes['Background'].inputs[0].default_value=(c[0]**2.2,c[1]**2.2,c[2]**2.2,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.6
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=720 if mode!='tall' else 591; sc.render.resolution_y=1280
sc.render.resolution_percentage=100; sc.render.filepath=outp; sc.view_settings.view_transform='Standard'
bpy.ops.render.render(write_still=True)
