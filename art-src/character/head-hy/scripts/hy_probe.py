# blender -b <body.blend> --python hy_probe.py -- <outdir>
# Hunyuan source in character space next to the current body: textured Workbench renders + per-class extents.
import bpy, sys, os, json, math, numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import hy_load as H
from mathutils import Vector
OUT=sys.argv[sys.argv.index('--')+1]; os.makedirs(OUT,exist_ok=True)
W,UV,I,cls,alb=H.load()
open('/tmp/hy/alb.png','wb').write(alb)
me=bpy.data.meshes.new('HY'); me.vertices.add(len(W)); me.vertices.foreach_set('co',W.astype(np.float32).ravel())
me.loops.add(I.size); me.loops.foreach_set('vertex_index',I.astype(np.int32).ravel())
me.polygons.add(len(I)); me.polygons.foreach_set('loop_start',np.arange(0,I.size,3,dtype=np.int32)); me.polygons.foreach_set('loop_total',np.full(len(I),3,np.int32))
uvl=me.uv_layers.new(name='UVMap'); uv=UV[I.ravel()].copy(); uv[:,1]=1-uv[:,1]; uvl.data.foreach_set('uv',uv.astype(np.float32).ravel())
me.update(); o=bpy.data.objects.new('HY',me); bpy.context.scene.collection.objects.link(o)
m=bpy.data.materials.new('HYM'); m.use_nodes=True; t=m.node_tree.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load('/tmp/hy/alb.png')
m.node_tree.links.new(t.outputs[0],m.node_tree.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(m)
st={}
C=W[I].mean(1)
for k,n in enumerate(H.NAMES):
    s=C[cls==k]
    if len(s): st[n]=dict(n=int(len(s)),min=s.min(0).round(4).tolist(),max=s.max(0).round(4).tolist())
print('CLASS',json.dumps(st,indent=0))
json.dump(st,open(os.path.join(OUT,'class_extents.json'),'w'),indent=1)
# hide old head parts of the body
body=bpy.data.objects.get('LOD0_G2_BODY')
if body and not os.environ.get('KEEP_R2'):
    import bmesh
    gi={g.name:g.index for g in body.vertex_groups}
    tags={gi[t] for t in ('_tag_skull','_tag_hat','_tag_hair_shell','hair.fringe','hair.back') if t in gi}
    bm=bmesh.new(); bm.from_mesh(body.data); dl=bm.verts.layers.deform.active
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if any(any(g in tags and w>0.5 for g,w in v[dl].items()) for v in f.verts)],context='FACES')
    bm.to_mesh(body.data); bm.free()
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading
sh.light='STUDIO'; sh.color_type='TEXTURE'; sc.view_settings.view_transform='Standard'
sc.render.resolution_x=sc.render.resolution_y=700
cd=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
cd.type='ORTHO'; cd.ortho_scale=float(os.environ.get('SCALE','0.6'))
tgt=Vector((0,0,float(os.environ.get('TZ','1.50'))))
for nm,az,el in (('front',0,0),('side',90,0),('back',180,0),('q34',35,0),('game30',20,30)):
    a=math.radians(az); e=math.radians(el); d=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
    cam.location=tgt+d*4; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(OUT,f'hy_{nm}.png'); bpy.ops.render.render(write_still=True)
