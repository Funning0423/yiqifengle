import bpy, numpy as np, collections
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2/scene/cine_m1_base.blend')
b=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']; me=b.data
used=np.zeros(len(me.vertices),bool)
matv=collections.defaultdict(set)
for p in me.polygons:
    for v in p.vertices: used[v]=True; matv[p.material_index].add(v)
print('USED',used.sum(),'of',len(me.vertices))
co=np.array([b.matrix_world@v.co for v in me.vertices])
for i,s in matv.items():
    s=np.array(sorted(s)); m=me.materials[i]
    print('MAT',i,m.name if m else None,len(s),'z',round(co[s,2].min(),4),round(co[s,2].max(),4))
vg=[g.name for g in b.vertex_groups]
W=np.zeros((len(me.vertices),len(vg)))
for v in me.vertices:
    for g in v.groups: W[v.index,g.group]=g.weight
dom=np.array(vg)[W.argmax(1)]
for n in vg:
    s=used&(dom==n)
    if s.any(): print('VG',n,s.sum(),'z',round(co[s,2].min(),4),round(co[s,2].max(),4))
h=bpy.data.objects['G2_HAIR_BOB_R5G2']; hc=np.array([h.matrix_world@v.co for v in h.data.vertices]); print('HAIR z',hc[:,2].min(),hc[:,2].max())
lo=~used; print('LOOSE z',co[lo,2].min() if lo.any() else None, co[lo,2].max() if lo.any() else None, 'dom',collections.Counter(dom[lo]).most_common(5))
