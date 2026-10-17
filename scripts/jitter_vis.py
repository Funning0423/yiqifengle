"""which cloth vertices pop (2nd difference > THR mm/frame^2) and are they visible from the game camera (R24 eye; ray hits the same object within 3 mm)?
usage: blender -b --python jitter_vis.py -- <blend> <checker_scripts_dir> <out.json> [thr_mm]"""
import bpy, sys, json, numpy as np, math
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out=a[:3]; THR=float(a[3]) if len(a)>3 else 3.0
sys.path.insert(0,sdir); import checker as C, clips
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=blend); ck=C.Checker(); sc=bpy.context.scene
for o in bpy.data.objects:
    if o.name.startswith('col_') or o.name=='CHAIR_VARIANT_arms_NOT_IN_GAME': o.hide_viewport=True
PLAN=json.load(open('/workspace/wechat-game/team/cinematic/refs/oi-handoff/evidence/CAMERA-MOTION-EVIDENCE-20261009-v1/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/camera_render_plan.json'))
eye=Vector((PLAN['poses'][0]['position_game_m'][0],-PLAN['poses'][0]['position_game_m'][2],PLAN['poses'][0]['position_game_m'][1]))
objs=[C.DRESS,C.APRON]+(['G2_BOW_TAILS_R5G2'] if 'G2_BOW_TAILS_R5G2' in bpy.data.objects else [])
clips.activate('cine_open_stand'); X={o:[] for o in objs}
for f in range(91):
    sc.frame_set(f)
    for o in objs: X[o].append(ck.ev(o,False)[0])
res={'thr_mm':THR,'eye':list(eye),'frames':[]}
for f in range(1,90):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get(); row={'frame':f}
    for o in objs:
        A=np.array(X[o][f-1:f+2]); acc=np.linalg.norm(A[2]-2*A[1]+A[0],axis=1)*1000; idx=np.where(acc>THR)[0]
        vis=[]; 
        for i in idx[np.argsort(-acc[idx])][:400]:
            P=Vector(A[1][i]); d=P-eye; L=d.length; hit,loc,n,fi,ob,M=sc.ray_cast(dg,eye,d.normalized(),distance=L+0.01)
            if hit and ob.name==o and (loc-P).length<0.003: vis.append(float(acc[i]))
        row[o]={'n_pop':int(len(idx)),'max_pop':round(float(acc.max()),2),'n_pop_visible':len(vis),'max_pop_visible':round(max(vis),2) if vis else 0.0}
    res['frames'].append(row); print('J',f,{o[3:8]:(row[o]['n_pop'],row[o]['max_pop'],row[o]['n_pop_visible'],row[o]['max_pop_visible']) for o in objs},flush=True)
json.dump(res,open(out,'w')); print('JVDONE')
