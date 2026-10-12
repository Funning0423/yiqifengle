# blender -b --python render_albedo.py -- <hy|r2> <outdir> : albedo only (emission = base color), checks baked-in lighting
import bpy, sys, os, json
sys.path.insert(0,os.path.dirname(__file__)); import common as C
a=sys.argv[sys.argv.index('--')+1:]; M,O=a[0],a[1]; os.makedirs(O,exist_ok=True)
sc,sun,cam=C.reset(); sun.data.energy=0
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0
(C.load_hy if M=='hy' else C.load_r2)()
for m in bpy.data.materials:
    nt=m.node_tree
    if not nt: continue
    b=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']; out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL']
    if not b or not out: continue
    b=b[0]; e=nt.nodes.new('ShaderNodeEmission')
    src=b.inputs['Base Color'].links
    if src: nt.links.new(src[0].from_socket,e.inputs['Color'])
    else: e.inputs['Color'].default_value=b.inputs['Base Color'].default_value
    nt.links.new(e.outputs[0],out[0].inputs['Surface'])
sc.cycles.samples=16
for s in json.load(open(os.path.join(os.path.dirname(__file__),'shots.json')))[:4]:
    C.shoot(sc,sun,cam,s,os.path.join(O,'albedo_'+s['name']+'.png'))
print('DONE')
