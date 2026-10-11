# blender -b --python render.py -- <glb> <outdir> <shots.json> [clip frame]
import bpy, sys, math, os, json
from mathutils import Vector
a=sys.argv[sys.argv.index("--")+1:]
GLB,OUTD,SHOTS=a[0],a[1],a[2]
CLIP=a[3] if len(a)>3 else None; FR=float(a[4]) if len(a)>4 else 0
if GLB.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=GLB)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=30   # before import: the importer keys actions at the scene fps, clip/frame args are 30 fps frames
    bpy.ops.import_scene.gltf(filepath=GLB)
sc=bpy.context.scene; sc.render.fps=30
for o in list(bpy.data.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
if arm.animation_data:
    for t in arm.animation_data.nla_tracks: t.mute=True
    arm.animation_data.action=None
if CLIP:
    act=[x for x in bpy.data.actions if x.name.startswith(CLIP)][0]; arm.animation_data.action=act
    if len(act.slots): arm.animation_data.action_slot=act.slots[0]
    sc.frame_set(int(math.floor(FR)),subframe=FR-math.floor(FR))
else:
    for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.ops.mesh.primitive_plane_add(size=0.01,location=(0,0,-5)); g=bpy.context.object
gm=bpy.data.materials.new('g'); gm.diffuse_color=(0.55,0.58,0.52,1); g.data.materials.append(gm)
sc.render.engine='BLENDER_WORKBENCH'
sh=sc.display.shading; sh.light='STUDIO'; sh.studio_light=os.environ.get('SL','paint.sl'); sh.color_type='TEXTURE'; sh.show_shadows=False; sh.show_cavity=False
sh.show_specular_highlight=False
sh.background_type='WORLD'
w=bpy.data.worlds.new('w'); w.color=(0.58,0.61,0.66); sc.world=w
for m in bpy.data.materials:
    nt=m.node_tree
    if nt:
        for n in nt.nodes:
            if n.type=='BSDF_PRINCIPLED':
                c=n.inputs['Base Color'].default_value; solid=not n.inputs['Base Color'].is_linked
                if not solid:
                    src=n.inputs['Base Color'].links[0].from_node
                    if src.type=='MIX':   # factor * vertex colour (glTF import): use the factor colour
                        cs=[i.default_value for i in src.inputs if i.type=='RGBA' and not i.is_linked]
                        if cs: c=cs[-1]; solid=True
                m.diffuse_color=(c[0],c[1],c[2],1)
                if solid:
                    img=bpy.data.images.new('solid_'+m.name,4,4,float_buffer=True); img.generated_color=(c[0],c[1],c[2],1)
                    ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=img; nt.links.new(ti.outputs['Color'],n.inputs['Base Color']); nt.nodes.active=ti
sc.view_settings.view_transform='Standard'; sc.view_settings.exposure=float(os.environ.get('EXPO','0.30'))
meshes=[o for o in bpy.data.objects if o.type=='MESH' and o!=g and not o.hide_render]
_B=os.environ.get('BLINK')
if _B:
    du,dv=[float(x) for x in _B.split(',')]
    for o in meshes:
        if '_tag_eyes' in o.vertex_groups:
            gi=o.vertex_groups['_tag_eyes'].index; me_=o.data; uvl=me_.uv_layers[0]
            ev={v.index for v in me_.vertices if any(g.group==gi and g.weight>0.5 for g in v.groups)}
            for li,l in enumerate(me_.loops):
                if l.vertex_index in ev: uvl.data[li].uv=(uvl.data[li].uv[0]+du,uvl.data[li].uv[1]+dv)
# wireframe overlay copies (hidden unless shot asks)
wm=bpy.data.materials.new('wire'); wm.diffuse_color=(0.05,0.05,0.08,1)
wires=[]
for o in meshes:
    c=o.copy(); c.data=o.data.copy(); sc.collection.objects.link(c)
    c.data.materials.clear(); c.data.materials.append(wm)
    for p in c.data.polygons: p.material_index=0
    m=c.modifiers.new('w','WIREFRAME'); m.thickness=0.0012; m.use_relative_offset=False; m.use_even_offset=False
    # keep armature first
    while c.modifiers[0].type!='ARMATURE' and any(x.type=='ARMATURE' for x in c.modifiers): bpy.ops.object.select_all(action='DESELECT'); break
    wires.append(c)
for c in wires:
    arms=[m for m in c.modifiers if m.type=='ARMATURE']
    if arms and c.modifiers[0]!=arms[0]:
        with bpy.context.temp_override(object=c): bpy.ops.object.modifier_move_to_index(modifier=arms[0].name,index=0)
import os as _os
_P=_os.environ.get('POSE')
if _P:
    import json as _j
    sc.frame_set(0)
    for bn,(ax,deg) in _j.loads(_P).items():
        pb=arm.pose.bones[bn]; pb.rotation_mode='XYZ'
        r=[0,0,0]; r['XYZ'.index(ax)]=math.radians(deg); pb.rotation_euler=r
    bpy.context.view_layer.update()
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
for s in json.load(open(SHOTS)):
    az=math.radians(s['az']); el=math.radians(s.get('el',0)); d=4.0
    tgt=Vector(s['target'])
    # az=0: camera in front of her (she faces -Y) -> camera at -Y
    dirv=Vector((math.sin(az)*math.cos(el), -math.cos(az)*math.cos(el), math.sin(el)))
    cam.location=tgt+dirv*d
    cam.rotation_euler=(-dirv).to_track_quat('-Z','Y').to_euler()
    if s.get('persp'):
        cd.type='PERSP'; cd.lens=s['persp']; cam.location=tgt+dirv*s.get('dist',2.0)
    else:
        cd.type='ORTHO'; cd.ortho_scale=s['scale']
    cd.clip_start=0.01
    sc.render.resolution_x,sc.render.resolution_y=s.get('res',[800,800])
    w=s.get('wire',False)
    for c in wires: c.hide_render=not w
    sh.color_type=s.get('color','TEXTURE')
    hide=s.get('hide',[])
    for o in meshes: o.hide_render=any(h in o.name for h in hide)
    for c,o in zip(wires,meshes): c.hide_render=(not w) or o.hide_render
    sc.render.filepath=os.path.join(OUTD,s['name']+'.png'); bpy.ops.render.render(write_still=True)
