import bpy, bmesh, math, numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='src/transport_balloon_893ac038.glb')
leaf=bpy.data.objects['basket_door_leaf']; bk=bpy.data.objects['balloon_basket']; door=bpy.data.objects['basket_door']
def islands(o):
    bm=bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); seen=set(); out=[]
    M=o.matrix_world
    for v in bm.verts:
        if v.index in seen: continue
        st=[v]; comp=[]
        while st:
            x=st.pop()
            if x.index in seen: continue
            seen.add(x.index); comp.append(x.index); st+= [e.other_vert(x) for e in x.link_edges]
        V=np.array([tuple(M@bm.verts[i].co) for i in comp]); mats={f.material_index for i in comp for f in bm.verts[i].link_faces}
        out.append((len(comp),V.min(0).round(3),V.max(0).round(3),mats))
    return out
print('LEAF mats',[m.name for m in leaf.data.materials])
for c in islands(leaf): print('LEAF island',c)
# basket faces inside the opening region (glTF Z>0.6 => blender y<-0.6), |x|<0.4, z<1.15
M=bk.matrix_world; cnt=0; post=[]
for p in bk.data.polygons:
    P=np.array([tuple(M@bk.data.vertices[i].co) for i in p.vertices]); c=P.mean(0)
    if abs(c[0])<0.40-0.005 and c[1]<-0.6 and c[2]<1.15 and c[2]>0.005: cnt+=1; post.append(c.round(3))
print('BASKET faces centred in opening', cnt, post[:10])
# floor: basket faces near z in [0,0.15] inside r<0.6
fl=[tuple(np.array([tuple(M@bk.data.vertices[i].co) for i in p.vertices]).mean(0).round(3)) for p in bk.data.polygons]
fz=[c for c in fl if abs(c[0])<0.6 and abs(c[1])<0.6 and c[2]<0.3]
print('floor-ish faces', len(fz), sorted(set(round(c[2],3) for c in fz)))
# door sweep vs basket
bm=bmesh.new(); bm.from_mesh(bk.data); bm.transform(M); btree=BVHTree.FromBMesh(bm)
Lv=np.array([tuple(v.co) for v in leaf.data.vertices]); LP=[tuple(p.vertices) for p in leaf.data.polygons]
res=[]
for d in np.arange(0,100.01,0.5):
    door.rotation_mode='XYZ'; door.rotation_euler=(0,0,math.radians(d)); bpy.context.view_layer.update()
    W=leaf.matrix_world; V=[tuple(W@Vector(v)) for v in Lv]; lt=BVHTree.FromPolygons(V,LP)
    ov=btree.overlap(lt); 
    # min distance leaf verts->basket
    md=min(btree.find_nearest(Vector(v))[3] for v in V)
    res.append((d,len(ov),round(md*1000,1)))
bad=[r for r in res if r[1]]
print('SWEEP overlaps',len(bad),bad[:8]); print('min dist mm per 10deg',[r for r in res if r[0]%10==0])
# leaf geometry at 100deg extents; free edge
door.rotation_euler=(0,0,math.radians(100)); bpy.context.view_layer.update(); W=leaf.matrix_world
V=np.array([tuple(W@Vector(v)) for v in Lv]); print('leaf@100 min',V.min(0).round(3),'max',V.max(0).round(3))
door.rotation_euler=(0,0,math.radians(90)); bpy.context.view_layer.update(); V=np.array([tuple(leaf.matrix_world@Vector(v)) for v in Lv]); print('leaf@90 x',V[:,0].min().round(3),V[:,0].max().round(3),'y',V[:,1].min().round(3),V[:,1].max().round(3))
