"""Option 3 (proposal only, env asset not changed): fit col_int_chair_back to the REAL backrest (chair-local AABB of the backrest triangles, +2 mm),
then measure per-frame containment of body / bow / hair in the current proxy vs the fitted one.
usage: blender -b --python proxy_fit.py -- <blend> <checker_scripts_dir> <out.json>"""
import bpy, sys, json, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out=a[:3]; sys.path.insert(0,sdir); import checker as C, clips
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath=blend); ck=C.Checker(); T=ck.T
cco,ctri,CT,_=ck.chair; Mi=np.array(ck.chMi); M=np.array(ck.chM)
loc=cco@Mi[:3,:3].T+Mi[:3,3]
back=[i for i in range(len(ctri)) if (lambda c:c[1]>0.17 and c[2]>0.40)(loc[ctri[i]].mean(0))]
bv=loc[np.unique(ctri[back].ravel())]; lo=bv.min(0)-0.002; hi=bv.max(0)+0.002
bx=ck.boxes['col_int_chair_back']; bxl=bx@Mi[:3,:3].T+Mi[:3,3]
rep={'real_backrest_local_aabb_mm':{'min':(lo*1000).round(1).tolist(),'max':(hi*1000).round(1).tolist(),'size':((hi-lo)*1000).round(1).tolist()},
     'current_proxy_local_corners_mm_min':(bxl.min(0)*1000).round(1).tolist(),'current_proxy_local_corners_mm_max':(bxl.max(0)*1000).round(1).tolist(),'frames':[]}
def depth_aabb(p):
    ins=((p>lo)&(p<hi)).all(1)
    if not ins.any():
        q=np.clip(p,lo,hi); return -float(np.linalg.norm(p-q,axis=1).min())*1000,0
    d=np.minimum(p[ins]-lo,hi-p[ins]).min(1); return float(d.max())*1000,int(ins.sum())
for clip,n in (('cine_open_stand',90),('cine_open_turn',45)):
    clips.activate(clip)
    for f in range(n+1):
        bpy.context.scene.frame_set(f); bc,_=ck.ev(C.BODY); hc,_=ck.ev(C.HAIR); r={'clip':clip,'frame':f}
        for nm,pts in (('body_nobow',bc[np.unique(T[ck.parts['body_nobow']].ravel())]),('bow',bc[np.unique(T[ck.parts['bow']].ravel())]),('hair',hc),('legs',bc[np.unique(np.concatenate([T[ck.parts['legL']],T[ck.parts['legR']]]).ravel())])):
            pl=pts@Mi[:3,:3].T+Mi[:3,3]; d,k=depth_aabb(pl); r[nm+'_fitted']={'depth_mm':round(d,2),'verts_inside':k}
        rep['frames'].append(r)
json.dump(rep,open(out,'w'),indent=0); print('PDONE',json.dumps({k:v for k,v in rep.items() if k!='frames'}))
