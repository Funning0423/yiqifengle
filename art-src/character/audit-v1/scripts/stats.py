import bpy, sys, json, bmesh, mathutils
from collections import Counter, defaultdict
a=sys.argv[sys.argv.index("--")+1:]; GLB,OUT=a[0],a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
R={'armature':arm.name,'bones':[],'meshes':{}}
for b in arm.data.bones:
    R['bones'].append(dict(name=b.name,parent=b.parent.name if b.parent else None,head=[round(x,4) for x in b.head_local],tail=[round(x,4) for x in b.tail_local],deform=b.use_deform))
dg=bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type!='MESH': continue
    me=o.data
    bm=bmesh.new(); bm.from_mesh(me)
    tris=sum(len(f.verts)-2 for f in bm.faces)
    nonman=sum(1 for e in bm.edges if not e.is_manifold)
    boundary=sum(1 for e in bm.edges if e.is_boundary)
    # islands (by vertex connectivity)
    bm.verts.ensure_lookup_table()
    seen=set(); islands=0
    for v in bm.verts:
        if v.index in seen: continue
        islands+=1; st=[v]; seen.add(v.index)
        while st:
            x=st.pop()
            for e in x.link_edges:
                y=e.other_vert(x)
                if y.index not in seen: seen.add(y.index); st.append(y)
    # coincident verts (split by uv/normals)
    kd=mathutils.kdtree.KDTree(len(me.vertices))
    for v in me.vertices: kd.insert(v.co,v.index)
    kd.balance()
    dup=0
    for v in me.vertices:
        if len(kd.find_range(v.co,1e-5))>1: dup+=1
    gnames=[g.name for g in o.vertex_groups]
    infl=Counter(); bonew=defaultdict(float); bonec=Counter(); maxw=0
    unw=0
    for v in me.vertices:
        gs=[(g.group,g.weight) for g in v.groups if g.weight>1e-4]
        infl[len(gs)]+=1
        if not gs: unw+=1
        for gi,w in gs:
            bonew[gnames[gi]]+=w; bonec[gnames[gi]]+=1
    mats=[]
    for i,ms in enumerate(me.materials):
        n=sum(1 for p in me.polygons if p.material_index==i)
        mats.append(dict(name=ms.name if ms else None, faces=n, tris=sum(len(p.vertices)-2 for p in me.polygons if p.material_index==i)))
    bb=[o.matrix_world@mathutils.Vector(c) for c in o.bound_box]
    R['meshes'][o.name]=dict(verts=len(me.vertices),faces=len(me.polygons),tris=tris,edges=len(me.edges),
        nonmanifold_edges=nonman,boundary_edges=boundary,islands=islands,coincident_verts=dup,
        uv_layers=[u.name for u in me.uv_layers],color_attrs=[c.name for c in me.color_attributes],
        shape_keys=[k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [],
        materials=mats,influence_hist=dict(sorted(infl.items())),unweighted=unw,
        bones_by_vertcount=dict(sorted(bonec.items(),key=lambda x:-x[1])),
        smooth_faces=sum(1 for p in me.polygons if p.use_smooth),
        bbox_min=[round(min(v[i] for v in bb),4) for i in range(3)],bbox_max=[round(max(v[i] for v in bb),4) for i in range(3)])
    bm.free()
json.dump(R,open(OUT,'w'),indent=1,ensure_ascii=False)
