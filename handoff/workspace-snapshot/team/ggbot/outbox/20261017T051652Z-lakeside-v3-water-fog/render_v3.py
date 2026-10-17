import bpy, json, math, sys, os
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
SK=os.environ.get('SKIPTPL')=='1'; nskip=0
for i in S['instances']:
    if SK and i['name']==i['glb'][:-4]: nskip+=1; continue
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

T=E('TINT'); V3=os.environ.get('V3')=='1'
if V3:  # Cocos has no env specular on the lake: glossy rays see black world, only the sun lamp makes the streak
    gm=N.new('ShaderNodeMixShader'); Lk.new(lp.outputs['Is Glossy Ray'],gm.inputs[0]); Lk.new(ms.outputs[0],gm.inputs[1]); Lk.new(gm.outputs[0],out.inputs[0])
def water(o):
    m=o.data.materials[0].copy(); o.data=o.data.copy(); o.data.materials[0]=m
    nt2=m.node_tree; N2=nt2.nodes; L=nt2.links
    b=[n for n in N2 if n.bl_idname=='ShaderNodeBsdfPrincipled'][0]; src=b.inputs['Base Color'].links[0].from_socket
    mx=N2.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    L.new(src,mx.inputs[6]); mx.inputs[7].default_value=(*T,1); L.new(mx.outputs[2],b.inputs['Base Color'])
    if not V3: return
    outn=[n for n in N2 if n.bl_idname=='ShaderNodeOutputMaterial'][0]
    b.inputs['Roughness'].default_value=1.0; b.inputs['Specular IOR Level'].default_value=0.0
    fr=N2.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value=1.33  # F0 0.02
    cl=N2.new('ShaderNodeMath'); cl.operation='MINIMUM'; cl.inputs[1].default_value=0.85; L.new(fr.outputs[0],cl.inputs[0])
    g=N2.new('ShaderNodeNewGeometry'); neg=N2.new('ShaderNodeVectorMath'); neg.operation='SCALE'; neg.inputs['Scale'].default_value=-1
    L.new(g.outputs['Incoming'],neg.inputs[0]); rf=N2.new('ShaderNodeVectorMath'); rf.operation='REFLECT'; L.new(neg.outputs[0],rf.inputs[0]); L.new(g.outputs['Normal'],rf.inputs[1])
    sp=N2.new('ShaderNodeSeparateXYZ'); L.new(rf.outputs[0],sp.inputs[0])
    cr=N2.new('ShaderNodeValToRGB'); e=cr.color_ramp.elements
    e[0].position=0.0; e[0].color=(1,.5457,.1441,1); e[1].position=0.38; e[1].color=(.0116,.2747,.4793,1); x=e.new(0.16); x.color=(.9216,.5776,.2705,1)
    L.new(sp.outputs['Z'],cr.inputs[0])
    em=N2.new('ShaderNodeEmission'); L.new(cr.outputs[0],em.inputs[0]); em.inputs[1].default_value=float(os.environ.get('REFL','1'))*7.2*float(os.environ['K'])/math.pi
    m1=N2.new('ShaderNodeMixShader'); L.new(cl.outputs[0],m1.inputs[0]); L.new(b.outputs[0],m1.inputs[1]); L.new(em.outputs[0],m1.inputs[2])
    gl=N2.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value=float(os.environ.get('SPECR','0.07')); gl.inputs['Color'].default_value=(*[float(os.environ.get('SPEC','1.6'))*0.25]*3,1)
    ad=N2.new('ShaderNodeAddShader'); L.new(m1.outputs[0],ad.inputs[0]); L.new(gl.outputs[0],ad.inputs[1]); L.new(ad.outputs[0],outn.inputs['Surface'])
    print('WATER',o.name)
for o in sc.objects:
    if o.type=='MESH' and o.name.startswith('LK_lake'): water(o)
if os.environ.get('FOG')=='1':
    FC=(1.0,0.6172,0.3813); F0,FE=45.0,257.5
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        nt2=m.node_tree; L=nt2.links
        for outn in [n for n in nt2.nodes if n.bl_idname=='ShaderNodeOutputMaterial']:
            if not outn.inputs['Surface'].links: continue
            s0=outn.inputs['Surface'].links[0].from_socket
            cd=nt2.nodes.new('ShaderNodeCameraData'); mr2=nt2.nodes.new('ShaderNodeMapRange'); mr2.clamp=True
            mr2.inputs[1].default_value=F0; mr2.inputs[2].default_value=FE; L.new(cd.outputs['View Distance'],mr2.inputs[0])
            fe=nt2.nodes.new('ShaderNodeEmission'); fe.inputs[0].default_value=(*FC,1); fe.inputs[1].default_value=float(os.environ.get('FOGS','1'))
            ms2=nt2.nodes.new('ShaderNodeMixShader'); L.new(mr2.outputs[0],ms2.inputs[0]); L.new(s0,ms2.inputs[1]); L.new(fe.outputs[0],ms2.inputs[2]); L.new(ms2.outputs[0],outn.inputs['Surface'])
print('SKIPPED_TEMPLATES',nskip)
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=720 if mode!='tall' else 591; sc.render.resolution_y=1280
sc.render.resolution_percentage=100; sc.render.filepath=outp; sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Punchy'; sc.view_settings.exposure=0.32
bpy.ops.render.render(write_still=True)
