import bpy, json
from collections import Counter, defaultdict
bpy.ops.import_scene.gltf(filepath='runtime.glb')
o=bpy.data.objects['LOD0_G2_BODY']; me=o.data; gn=[g.name for g in o.vertex_groups]
dom={}
pairs=Counter()
for v in me.vertices:
    gs=sorted([(g.weight,gn[g.group]) for g in v.groups if g.weight>1e-4],reverse=True)
    dom[v.index]=gs[0][1]
    if len(gs)>1: pairs[tuple(sorted([gs[0][1],gs[1][1]]))]+=1
mats=[m.name for m in me.materials]
reg=Counter()
for p in me.polygons:
    b=Counter(dom[i] for i in p.vertices).most_common(1)[0][0]
    reg[(mats[p.material_index],b)]+=1
for k,v in sorted(reg.items()): print('REG',k,v)
for k,v in pairs.most_common(): print('PAIR',k,v)
# per-material vertex counts
mv=defaultdict(set)
for p in me.polygons: mv[mats[p.material_index]].update(p.vertices)
print('MATV',{k:len(v) for k,v in mv.items()})
# hand verts count, hand tris
