import bpy, bmesh, json
from mathutils import Vector
P='/workspace/wechat-game/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/'
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/art/island/v2.2a/scene/env_scene_island_v2_2a.blend')
o=bpy.data.objects['env_island_props_merged']
print('mw', o.matrix_world)
me=o.data
bm=bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
# components
seen=set(); comps=[]
for v in bm.verts:
    if v.index in seen: continue
    st=[v]; c=[]; seen.add(v.index)
    while st:
        x=st.pop(); c.append(x.index)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y.index not in seen: seen.add(y.index); st.append(y)
    comps.append(c)
print('ncomps',len(comps))
mw=o.matrix_world
near=[]
for i,c in enumerate(comps):
    pts=[mw@bm.verts[j].co for j in c]
    cx=sum(p.x for p in pts)/len(pts); cy=sum(p.y for p in pts)/len(pts)
    if abs(cx+1.66)<1.2 and abs(cy+1.30)<1.2:
        near.append(i)
        print(i,len(c),'c',round(cx,3),round(cy,3),'x',round(min(p.x for p in pts),3),round(max(p.x for p in pts),3),'y',round(min(p.y for p in pts),3),round(max(p.y for p in pts),3),'z',round(min(p.z for p in pts),3),round(max(p.z for p in pts),3),
              'mat', set(f.material_index for v in c for f in bm.verts[v].link_faces))
