import bpy,sys,json
from collections import defaultdict
GLB=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB)
for o in bpy.data.objects:
    if o.type!='MESH' or not o.data.materials: continue
    me=o.data; gn={g.index:g.name for g in o.vertex_groups}
    print('MESH',o.name,len(me.vertices),[m.name for m in me.materials])
    R=defaultdict(lambda:[9,-9,9,-9,9,-9,0])
    for p in me.polygons:
        vs=[me.vertices[i] for i in p.vertices]
        def dom(v):
            gs=sorted([(g.weight,gn[g.group]) for g in v.groups],reverse=True); return gs[0][1] if gs else '-'
        k=(me.materials[p.material_index].name,dom(vs[0]))
        r=R[k]; c=p.center
        for a,i in ((c.x,0),(c.y,2),(c.z,4)): r[i]=min(r[i],a); r[i+1]=max(r[i+1],a)
        r[6]+=1
    for k,r in sorted(R.items()): print('  ',k,'x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f n=%d'%tuple(r))
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for b in arm.data.bones:
    h=arm.matrix_world@b.head_local; t=arm.matrix_world@b.tail_local
    print('BONE',b.name,'head',tuple(round(x,3) for x in h),'tail',tuple(round(x,3) for x in t),'parent',b.parent.name if b.parent else None)
