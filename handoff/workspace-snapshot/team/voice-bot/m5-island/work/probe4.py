import bpy, bmesh, math
from mathutils import Vector
V21='/workspace/wechat-game/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/assets/glb/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=V21+'env_exterior_collision.glb')
bpy.ops.import_scene.gltf(filepath=V21+'env_exterior_collision_island_extras.glb')
TC=(0,2.646)
for o in bpy.data.objects:
    print(o.name,o.type,o.parent.name if o.parent else None, len(o.data.polygons) if o.type=='MESH' else '', dict((k,str(o[k])[:80]) for k in o.keys()))
def comps(o):
    bm=bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen=set(); out=[]
    for v in bm.verts:
        if v.index in seen: continue
        st=[v]; c=[]; seen.add(v.index)
        while st:
            x=st.pop(); c.append(x.index)
            for e in x.link_edges:
                y=e.other_vert(x)
                if y.index not in seen: seen.add(y.index); st.append(y)
        out.append([o.matrix_world@bm.verts[i].co for i in c])
    return out
tw=bpy.data.objects['col_ext_tower_wall']
for c in comps(tw)[:40]:
    rs=[math.hypot(p.x-TC[0],p.y-TC[1]) for p in c]; an=[math.degrees(math.atan2(p.y-TC[1],p.x-TC[0])) for p in c]
    print('plate n',len(c),'r',round(min(rs),3),round(max(rs),3),'ang',round(min(an),1),round(max(an),1),'z',round(min(p.z for p in c),2),round(max(p.z for p in c),2))
pm=bpy.data.objects['col_ext_props_misc']
for c in comps(pm):
    cx=sum(p.x for p in c)/len(c); cy=sum(p.y for p in c)/len(c)
    if abs(cx+1.66)<0.5 and abs(cy+1.3)<1.5:
        print('fence hull n',len(c),'x',round(min(p.x for p in c),3),round(max(p.x for p in c),3),'y',round(min(p.y for p in c),3),round(max(p.y for p in c),3),'z',round(min(p.z for p in c),3),round(max(p.z for p in c),3))
W=bpy.data.objects['col_ext_ground_walkable']
bm=bmesh.new(); bm.from_mesh(W.data)
bnd=[e for e in bm.edges if e.is_boundary]
nb=[e for e in bnd if all(abs((W.matrix_world@v.co).x+1.66)<0.4 and -2.7<(W.matrix_world@v.co).y<0.1 for v in e.verts)]
print('walkable boundary edges near fence',len(nb))
for e in nb[:40]: print([tuple(round(c,3) for c in (W.matrix_world@v.co)) for v in e.verts])
