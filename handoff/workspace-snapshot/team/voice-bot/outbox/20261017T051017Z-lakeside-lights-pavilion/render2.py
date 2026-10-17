import bpy, json, math, sys
from mathutils import Vector, Quaternion, Matrix
argv=sys.argv[sys.argv.index('--')+1:]; scenef,preset,outp=argv[0],argv[1],argv[2]
S=json.load(open(scenef))
M='/tmp/wt-lk2/creator-build-project/assets/bundles/region_lakeside/models/'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; cache={}
def vc(mat):
    if mat.get('vc'): return
    nt=mat.node_tree; b=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]; inp=b.inputs['Base Color']
    ca=nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name='Color'
    mul=nt.nodes.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs[0].default_value=1
    if inp.is_linked: src=inp.links[0].from_socket; nt.links.new(src,mul.inputs[6])
    else: mul.inputs[6].default_value=inp.default_value
    nt.links.new(ca.outputs['Color'],mul.inputs[7]); nt.links.new(mul.outputs[2],inp); mat['vc']=1
def src(glb):
    if glb in cache: return cache[glb]
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=M+glb)
    objs=[o for o in bpy.data.objects if o not in before]
    for o in objs:
        o.hide_render=True; o.hide_viewport=True
        if o.type=='MESH' and any(a.name=='Color' for a in o.data.color_attributes):
            for s in o.material_slots:
                if s.material and s.material.use_nodes: vc(s.material)
    cache[glb]=[o for o in objs if o.type=='MESH']; return cache[glb]
for i in S['instances']:
    x,y,z=i['pos']; qx,qy,qz,qw=i['rot_quat_xyzw']; sx,sy,sz=i['scale']
    for m in src(i['glb']):
        o=bpy.data.objects.new(i['name'],m.data); sc.collection.objects.link(o)
        o.matrix_world=Matrix.Translation((x,-z,y))@Quaternion((qw,qx,-qz,qy)).to_matrix().to_4x4()@Matrix.Diagonal((sx,sz,sy,1))@m.matrix_world
P=json.load(open('/tmp/lk/presets.json'))[preset]
if P.get('waterTint'):
    for o in bpy.data.objects:
        if o.type=='MESH' and o.data.name.startswith('LK_lake') or (o.type=='MESH' and any(x['glb']=='LK_lake.glb' and x['name']==o.name for x in S['instances'])):
            for s_ in o.material_slots:
                m=s_.material
                if m and not m.get('wt'):
                    m=m.copy(); s_.link='OBJECT'; s_.material=m; m['wt']=1
                    b=[n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'][0]; inp=b.inputs['Base Color']; srcs=inp.links[0].from_socket
                    t=m.node_tree.nodes.new('ShaderNodeMix'); t.data_type='RGBA'; t.blend_type='MULTIPLY'; t.inputs[0].default_value=1
                    m.node_tree.links.new(srcs,t.inputs[6]); t.inputs[7].default_value=P['waterTint']+[1]; m.node_tree.links.new(t.outputs[2],inp)
pose=S['poses']['ref']; cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
px,py,pz=pose['position']; co.location=(px,-pz,py); qx,qy,qz,qw=pose['rotation']; co.rotation_mode='QUATERNION'
co.rotation_quaternion=Quaternion((1,0,0),math.radians(90))@Quaternion((qw,qx,qy,qz)); cam.sensor_fit='VERTICAL'; cam.angle_y=math.radians(pose['fovVerticalDeg']); cam.clip_end=1000
ld=bpy.data.lights.new('Sun','SUN'); ld.energy=7.2*P['sunScale']; ld.color=P['sunColor']; ld.angle=math.radians(1.2); ld.use_shadow=P.get('shadow',False)
lo=bpy.data.objects.new('Sun',ld); sc.collection.objects.link(lo); fx,fy,fz=P['sunForward']; lo.rotation_mode='QUATERNION'; lo.rotation_quaternion=Vector((fx,-fz,fy)).to_track_quat('-Z','Y')
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes; Lk=nt.links; bg=N['Background']; out=N['World Output']
if P['amb']=='normal':  # GGbot's proxy
    g=N.new('ShaderNodeNewGeometry'); s_=N.new('ShaderNodeSeparateXYZ'); Lk.new(g.outputs['Normal'],s_.inputs[0]); f=s_.outputs['Z']; lo_,hi=-1,1
else:                   # direction step at the horizon, like the r5h3 world (sky above, ground below)
    t=N.new('ShaderNodeTexCoord'); s_=N.new('ShaderNodeSeparateXYZ'); Lk.new(t.outputs['Generated'],s_.inputs[0]); f=s_.outputs['Z']; lo_,hi=-0.02,0.02
mr=N.new('ShaderNodeMapRange'); Lk.new(f,mr.inputs[0]); mr.inputs[1].default_value=lo_; mr.inputs[2].default_value=hi
mix=N.new('ShaderNodeMix'); mix.data_type='RGBA'; Lk.new(mr.outputs[0],mix.inputs[0]); mix.inputs[6].default_value=P['ground']+[1]; mix.inputs[7].default_value=P['sky']+[1]
amb=N.new('ShaderNodeBackground'); Lk.new(mix.outputs[2],amb.inputs[0]); amb.inputs[1].default_value=P['ambStrength']
h=P['clear'].lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]; bg.inputs[0].default_value=(c[0]**2.2,c[1]**2.2,c[2]**2.2,1)
lp=N.new('ShaderNodeLightPath'); ms=N.new('ShaderNodeMixShader'); Lk.new(lp.outputs['Is Camera Ray'],ms.inputs[0]); Lk.new(amb.outputs[0],ms.inputs[1]); Lk.new(bg.outputs[0],ms.inputs[2]); Lk.new(ms.outputs[0],out.inputs[0])
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=720; sc.render.resolution_y=1280; sc.render.resolution_percentage=100; sc.render.filepath=outp
sc.view_settings.view_transform='AgX'; sc.view_settings.look='None'; sc.view_settings.exposure=0.32
bpy.ops.render.render(write_still=True)
