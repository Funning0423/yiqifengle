# Diagnose: legs x dress in pass2b sit pose, original weights vs 4-limited (works on src_copy, never saved)
import bpy,sys,json,numpy as np,collections
sys.path.insert(0,'scripts'); import poselib as P, checker as C
class Mini(C.Checker):
    def __init__(s):
        b=bpy.data.objects[C.BODY]; me=b.data
        vg=[g.name for g in b.vertex_groups]; W=np.zeros((len(me.vertices),len(vg)))
        for v in me.vertices:
            for g in v.groups: W[v.index,g.group]=g.weight
        s.dom=np.array(vg)[W.argmax(1)]; co,T=s.ev(C.BODY); s.T=T
        par=np.arange(len(co))
        def f(x):
            while par[x]!=x: par[x]=par[par[x]]; x=par[x]
            return x
        for t in T:
            r=[f(v) for v in t]
            for k in r[1:]: par[f(k)]=r[0]
        comp=np.array([f(v) for v in range(len(co))]); tc=comp[T[:,0]]; main=collections.Counter(tc).most_common(1)[0][0]
        tdom=s.dom[T[:,0]]; ism=tc==main
        s.parts={'legL':np.where(~ism&np.isin(tdom,['thigh.L','shin.L','foot.L']))[0],'legR':np.where(~ism&np.isin(tdom,['thigh.R','shin.R','foot.R']))[0],
                 'torso':np.where(ism&np.isin(tdom,['hips','spine','chest']))[0]}
def count(ck,pose):
    P.reset()
    if pose=='sit': P.apply_list(P.SIT); P.set_sk(1.0)
    else: P.set_sk(0.0)
    bc,_=ck.ev(C.BODY); out={}
    for mode,solid in [('visible',True),('midsurface',False)]:
        for gn in [C.DRESS,C.APRON]:
            gc,gt=ck.ev(gn,solid); GT=ck.tree(gc,gt)
            for p in ['legL','legR','torso']:
                out[f'{mode}:{p}x{gn[3:8]}']=len(ck.tree(bc,ck.T[ck.parts[p]]).overlap(GT))
    return out
res={}
ck=Mini()
for pose in ['rest','sit']: res['orig_weights:'+pose]=count(ck,pose)
for n in (C.BODY,C.DRESS,C.APRON):
    o=bpy.data.objects[n]; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4); bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
for pose in ['rest','sit']: res['limit4:'+pose]=count(ck,pose)
json.dump(res,open('probe/weights_diag.json','w'),indent=1); print(json.dumps(res,indent=1)); print('DONE')
