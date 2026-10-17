import bpy, json, math, sys
from mathutils import Vector, Quaternion
argv=sys.argv[sys.argv.index('--')+1:]; mode,outp=argv[0],argv[1]
S=json.load(open('/workspace/wechat-game/team/voice-bot/outbox/20261017T043229Z-lakeside-playable/screenshots/scene.json'))
M='/tmp/a3wt/creator-build-project/assets/bundles/region_lakeside/models/'
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
import os
# D1: one sun = json Sun (direction/colour, energy 7.2 = ratio 1.0); dusk 0.31 -> hemispheric ambient; Sun.001 dropped
ld=bpy.data.lights.new('Sun','SUN'); ld.energy=7.2; ld.color=(1.0,0.6,0.32); ld.angle=math.radians(1.2); ld.use_shadow=(os.environ.get('SHADOW')=='1'); lo=bpy.data.objects.new('Sun',ld); sc.collection.objects.link(lo)
fx,fy,fz=(-0.4182,-0.3983,0.8164); d=Vector((fx,-fz,fy)); lo.rotation_mode='QUATERNION'; lo.rotation_quaternion=d.to_track_quat('-Z','Y')
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes; Lk=nt.links
bg=N['Background']; out=N['World Output']
geo=N.new('ShaderNodeNewGeometry'); sep=N.new('ShaderNodeSeparateXYZ'); mr=N.new('ShaderNodeMapRange'); mix=N.new('ShaderNodeMix'); mix.data_type='RGBA'
Lk.new(geo.outputs['Normal'],sep.inputs[0]); Lk.new(sep.outputs['Z'],mr.inputs[0]); mr.inputs[1].default_value=-1; mr.inputs[2].default_value=1
Lk.new(mr.outputs[0],mix.inputs[0]); import os; E=lambda k:[float(x) for x in os.environ[k].split(',')]
mix.inputs[6].default_value=(*E('GROUND'),1); mix.inputs[7].default_value=(*E('SKY'),1)
amb=N.new('ShaderNodeBackground'); Lk.new(mix.outputs[2],amb.inputs[0]); amb.inputs[1].default_value=7.2*float(os.environ['K'])/math.pi
h=S['clear'].lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
bg.inputs[0].default_value=(*E('CLEAR'),1); bg.inputs[1].default_value=1.0
lp=N.new('ShaderNodeLightPath'); ms=N.new('ShaderNodeMixShader')
Lk.new(lp.outputs['Is Camera Ray'],ms.inputs[0]); Lk.new(amb.outputs[0],ms.inputs[1]); Lk.new(bg.outputs[0],ms.inputs[2]); Lk.new(ms.outputs[0],out.inputs[0])
sc.view_settings.look='None'
T=E('TINT')
for o in sc.objects:
    if o.type=='MESH' and o.name.startswith('LK_lake'):
        m=o.data.materials[0].copy(); o.data=o.data.copy(); o.data.materials[0]=m
        nt2=m.node_tree; b=[n for n in nt2.nodes if n.bl_idname=='ShaderNodeBsdfPrincipled'][0]; src=b.inputs['Base Color'].links[0].from_socket
        mx=nt2.nodes.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
        nt2.links.new(src,mx.inputs[6]); mx.inputs[7].default_value=(*T,1); nt2.links.new(mx.outputs[2],b.inputs['Base Color'])
        print('TINTED',o.name)

sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=720 if mode!='tall' else 591; sc.render.resolution_y=1280
sc.render.resolution_percentage=100; sc.render.filepath=outp; sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Punchy'; sc.view_settings.exposure=0.32
bpy.ops.render.render(write_still=True)
