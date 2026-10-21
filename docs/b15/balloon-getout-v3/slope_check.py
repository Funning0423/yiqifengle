import bpy, json, numpy as np
d=json.load(open('qa_v3b.json')); L=d['timeline']['LTOT']; R=d['rows']
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]; body=bpy.data.objects['LOD0_G2_BODY']; sc=bpy.context.scene
# path polyline from root track
P=np.array([[r['x'],r['y']] for r in R]); S=np.array([r['s'] for r in R])
gi={g.index:g.name for g in body.vertex_groups}
FV={sd:[v.index for v in body.data.vertices if v.groups and gi[max(v.groups,key=lambda q:q.weight).group]=='foot.'+sd] for sd in 'LR'}
def gz(s): return 0.008*min(1,max(0,(s-(L-2))/2))
out=[];prev=None
for r in R:
    if r['s']<L-2.3: continue
    sc.frame_set(r['f']); dg=bpy.context.evaluated_depsgraph_get(); oe=body.evaluated_get(dg); me=oe.to_mesh(); M=oe.matrix_world
    row=[r['f'],r['seg']]
    for sd in 'LR':
        V=np.array([tuple(M@me.vertices[i].co) for i in FV[sd]]); lo=V[V[:,2].argmin()]
        k=np.argmin(np.linalg.norm(P-lo[:2],axis=1)); g=gz(S[k]); row.append(round((lo[2]-g)*1000,2))
    oe.to_mesh_clear(); out.append(row)
a=np.array([[x[2],x[3]] for x in out]); print('frames',out[0][0],out[-1][0],'min sole vs local ground mm',a.min(),'per side',a.min(0))
print('worst',sorted(out,key=lambda x:min(x[2],x[3]))[:5])
