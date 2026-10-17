import bpy,sys,math,json
from mathutils import Vector
exec(open('/tmp/v41/c2.py').read())
glb,out,mode,tag=sys.argv[-4:]
CJ=json.load(open('/tmp/v41/cams.json'))['poses']
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for n in ['state_court_after','state_court_after_flowers','state_gate_after','state_gate_after_flowers','state_bridge_after','state_ring_after_stars','Icosphere']:
    o=bpy.data.objects.get(n)
    if o: o.hide_render=True
day=mode=='day'; K=(1,1,1) if day else (0.32,0.38,0.62)
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt=m.node_tree; img=next((n for n in nt.nodes if n.type=='TEX_IMAGE'),None)
    if not img: continue
    out_n=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
    ca=nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name='Color'
    g=nt.nodes.new('ShaderNodeGamma'); g.inputs[1].default_value=2.2; nt.links.new(ca.outputs[0],g.inputs[0])
    mu=nt.nodes.new('ShaderNodeMix'); mu.data_type='RGBA'; mu.blend_type='MULTIPLY'; mu.inputs[0].default_value=1
    nt.links.new(img.outputs[0],mu.inputs[6]); nt.links.new(g.outputs[0],mu.inputs[7])
    mk=nt.nodes.new('ShaderNodeMix'); mk.data_type='RGBA'; mk.blend_type='MULTIPLY'; mk.inputs[0].default_value=1; mk.inputs[7].default_value=(*K,1)
    nt.links.new(mu.outputs[2],mk.inputs[6])
    em=nt.nodes.new('ShaderNodeEmission'); nt.links.new(mk.outputs[2],em.inputs[0])
    mix=nt.nodes.new('ShaderNodeMixShader'); tr=nt.nodes.new('ShaderNodeBsdfTransparent')
    nt.links.new(img.outputs[1],mix.inputs[0]); nt.links.new(tr.outputs[0],mix.inputs[1]); nt.links.new(em.outputs[0],mix.inputs[2]); nt.links.new(mix.outputs[0],out_n.inputs[0])
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=390; sc.render.resolution_y=844; sc.view_settings.view_transform='Standard'; sc.eevee.taa_render_samples=4
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']
bg.inputs[0].default_value=(0.2,0.5,0.8,1) if day else (0.02,0.04,0.1,1)
m=bpy.data.materials.new('chr'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs[0].default_value=(1,.8,.15,1); m.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,.8,.15,1); m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=1
bpy.ops.mesh.primitive_cylinder_add(radius=.22,depth=1.5); ch=bpy.context.object; ch.data.materials.append(m)
c=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(c); sc.camera=c; c.data.sensor_fit='VERTICAL'; c.data.clip_start=.1; c.data.clip_end=1500
def look(p,t,f): c.location=g2b(p); c.rotation_euler=(g2b(t)-g2b(p)).to_track_quat('-Z','Y').to_euler(); c.data.angle=math.radians(f)
for d in sorted(CJ,key=float):
    q=CJ[d]; ch.hide_render=False; ch.location=g2b(q['char'])+Vector((0,0,.75)); look(q['position'],q['target'],q['fov']); sc.render.filepath=f'{out}/{tag}_d{d}_{mode}.png'; bpy.ops.render.render(write_still=True)
ch.hide_render=True; look(*board_cam_aspect(390/844)); sc.render.filepath=f'{out}/{tag}_board09_{mode}.png'; bpy.ops.render.render(write_still=True)
