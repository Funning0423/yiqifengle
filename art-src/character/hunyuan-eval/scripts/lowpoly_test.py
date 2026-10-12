# blender -b --python lowpoly_test.py -- <outdir>
# Feasibility only: auto-reduce the sample to ~5k tris and see what survives (silhouette + texture).
#  A dec5k + original 4096^2 albedo/normal/MR (original fragmented UVs)
#  B dec5k + the same albedo downscaled to 512^2 (fragmented UVs, no re-pack)
#  C dec5k + Smart UV re-unwrap + bake albedo from the 1.5M source to a new 512^2 atlas
#  Q QuadriFlow remesh (from a 150k pre-decimate) to ~2.5k quads (=~5k tris) + same 512^2 bake
import bpy, sys, os, json, time, math
sys.path.insert(0,os.path.dirname(__file__)); import common as C
O=sys.argv[sys.argv.index('--')+1]; os.makedirs(O,exist_ok=True)
LOG={}
sc,sun,cam=C.reset()
hi=C.load_hy()[0]; hi.name='HI'
# head-only test: weld glTF UV-seam splits (UVs stay as face-corner data), drop the bust below the neck (raw z<0.22)
import bmesh
t=time.time(); bm=bmesh.new(); bm.from_mesh(hi.data)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-6)
bpy.context.view_layer.update(); MW=hi.matrix_world.copy(); zc=C.HY_T[2]+0.22*C.HY_S
cut=[f for f in bm.faces if (MW@f.calc_center_median()).z<zc]
bmesh.ops.delete(bm,geom=cut,context='FACES'); bm.to_mesh(hi.data); bm.free()
LOG['weld_cut_s']=round(time.time()-t,1); LOG['head_only_src_tris']=len(hi.data.polygons); LOG['head_only_src_verts']=len(hi.data.vertices)
SH=[s for s in json.load(open(os.path.join(os.path.dirname(__file__),'shots.json'))) if s['name'] in ('front','q34')]
def tris(o): return sum(len(p.vertices)-2 for p in o.data.polygons)
def dup(src,name):
    o=src.copy(); o.data=src.data.copy(); o.name=name; sc.collection.objects.link(o); return o
def apply(o,m):
    with bpy.context.temp_override(object=o,active_object=o,selected_objects=[o]): bpy.ops.object.modifier_apply(modifier=m.name)
def render(o,tag,wire=False):
    for x in bpy.data.objects:
        if x.type=='MESH': x.hide_render=(x!=o)
    for s in SH:
        C.shoot(sc,sun,cam,s,os.path.join(O,f'{tag}_{s["name"]}.png'))
    if wire:
        mats=list(o.data.materials); wm=wire_mat(mats[0])
        o.data.materials[0]=wm
        C.shoot(sc,sun,cam,dict(SH[0],name='wire'),os.path.join(O,f'{tag}_wire.png'))
        C.shoot(sc,sun,cam,dict(SH[1],name='wire'),os.path.join(O,f'{tag}_wire_q34.png'))
        o.data.materials[0]=mats[0]
def wire_mat(base):
    m=base.copy(); nt=m.node_tree; b=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]
    out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'][0]
    w=nt.nodes.new('ShaderNodeWireframe'); w.use_pixel_size=True; w.inputs[0].default_value=1.0
    e=nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value=(0.02,0.02,0.05,1)
    mx=nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(w.outputs[0],mx.inputs[0]); nt.links.new(b.outputs[0],mx.inputs[1]); nt.links.new(e.outputs[0],mx.inputs[2])
    nt.links.new(mx.outputs[0],out.inputs['Surface']); return m
# ---- A: decimate
t=time.time(); a=dup(hi,'DEC5K'); m=a.modifiers.new('d','DECIMATE'); m.ratio=5000/tris(hi); m.use_collapse_triangulate=True; apply(a,m)
LOG['decimate_s']=round(time.time()-t,1); LOG['A_tris']=tris(a); LOG['A_verts']=len(a.data.vertices)
render(a,'A_dec5k_tex4k',wire=True)
# ---- B: same UVs, albedo 512
img=[n for n in a.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE']
mb=a.data.materials[0].copy(); a.data.materials[0]=mb
for n in mb.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.image:
        im=n.image.copy(); im.scale(512,512); n.image=im
render(a,'B_dec5k_tex512_sameUV')
# ---- C: re-unwrap + bake 512 from high
def bake_to(o,tag,size=512):
    t=time.time(); o.hide_render=False
    for x in bpy.data.objects: x.select_set(False)
    o.hide_set(False); o.select_set(True); bpy.context.view_layer.objects.active=o
    while len(o.data.uv_layers)>1: o.data.uv_layers.remove(o.data.uv_layers[-1])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(72),island_margin=0.0,area_weight=1.0,scale_to_bounds=True)
    bpy.ops.uv.pack_islands(margin=0.004,rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    import bmesh as _b
    bm=_b.new(); bm.from_mesh(o.data); uvl=bm.loops.layers.uv.active
    # count UV islands (face-connectivity through shared UV coords)
    seen=set(); isl=0
    for f in bm.faces:
        if f.index in seen: continue
        isl+=1; st=[f]; seen.add(f.index)
        while st:
            g=st.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h.index in seen: continue
                    ok=all(any((l1[uvl].uv-l2[uvl].uv).length<1e-5 for l2 in h.loops if l2.vert==l1.vert) for l1 in g.loops if l1.vert in e.verts)
                    if ok: seen.add(h.index); st.append(h)
    bm.free(); LOG[tag+'_uv_islands']=isl
    im=bpy.data.images.new(tag+'_alb',size,size); 
    mat=bpy.data.materials.new(tag); mat.use_nodes=True; nt=mat.node_tree
    tn=nt.nodes.new('ShaderNodeTexImage'); tn.image=im; nt.nodes.active=tn
    b=nt.nodes['Principled BSDF']; nt.links.new(tn.outputs[0],b.inputs['Base Color']); b.inputs['Roughness'].default_value=0.7
    o.data.materials.clear(); o.data.materials.append(mat)
    # bake: emission-only copy of high material
    hm=hi.data.materials[0]; hn=hm.node_tree; hb=[n for n in hn.nodes if n.type=='BSDF_PRINCIPLED'][0]
    hout=[n for n in hn.nodes if n.type=='OUTPUT_MATERIAL'][0]; old=hout.inputs['Surface'].links[0].from_socket
    e=hn.nodes.new('ShaderNodeEmission'); hn.links.new(hb.inputs['Base Color'].links[0].from_socket,e.inputs['Color']); hn.links.new(e.outputs[0],hout.inputs['Surface'])
    for x in bpy.data.objects: x.select_set(False)
    hi.hide_render=False; hi.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active=o
    sc.cycles.samples=4; sc.render.bake.use_selected_to_active=True; sc.render.bake.cage_extrusion=0.01; sc.render.bake.max_ray_distance=0.03
    sc.render.bake.margin=4
    bpy.ops.object.bake(type='EMIT')
    hn.links.new(old,hout.inputs['Surface']); sc.cycles.samples=int(os.environ.get('SPP','48'))
    im.filepath_raw=os.path.join(O,tag+'_albedo512.png'); im.file_format='PNG'; im.save()
    LOG[tag+'_bake_s']=round(time.time()-t,1)
c=dup(a,'DEC5K_BAKE'); bake_to(c,'C_dec5k_bake512'); render(c,'C_dec5k_bake512')
# ---- Q: quadriflow
try:
    t=time.time(); q=dup(hi,'QF'); m=q.modifiers.new('d','DECIMATE'); m.ratio=60000/tris(hi); apply(q,m)
    with bpy.context.temp_override(object=q,active_object=q,selected_objects=[q]):
        r=bpy.ops.object.quadriflow_remesh(target_faces=2600,use_preserve_sharp=False,use_mesh_symmetry=False,seed=1)
    LOG['Q_op']=str(r)
    LOG['Q_remesh_s']=round(time.time()-t,1); LOG['Q_tris']=tris(q); LOG['Q_quads']=len(q.data.polygons)
    bake_to(q,'Q_quadriflow_bake512'); render(q,'Q_quadriflow_bake512',wire=True)
except Exception as ex: LOG['Q_error']=repr(ex)
json.dump(LOG,open(os.path.join(O,'lowpoly_log.json'),'w'),indent=1); print('LOG',LOG)
