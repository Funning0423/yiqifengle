"""cloth smoothness: per-frame max vertex speed (mm/frame) and max second difference (mm/frame^2, pop indicator) of dress / apron / bow midsurface.
usage: blender -b --python cloth_pop.py -- <blend> <checker_scripts_dir> <out.json>"""
import bpy, sys, json, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out=a[:3]; sys.path.insert(0,sdir); import checker as C, clips
bpy.ops.wm.open_mainfile(filepath=blend); ck=C.Checker(); res={}
objs=[C.DRESS,C.APRON]+(['G2_BOW_TAILS_R5G2'] if 'G2_BOW_TAILS_R5G2' in bpy.data.objects else [])
for clip,n in (('cine_open_stand',90),('cine_open_turn',45)):
    clips.activate(clip); X={o:[] for o in objs}
    for f in range(n+1):
        bpy.context.scene.frame_set(f)
        for o in objs: X[o].append(ck.ev(o,False)[0])
    r={}
    for o in objs:
        A=np.array(X[o]); v=np.linalg.norm(np.diff(A,axis=0),axis=2)*1000; acc=np.linalg.norm(A[2:]-2*A[1:-1]+A[:-2],axis=2)*1000
        r[o]={'max_speed_mm_per_frame':round(float(v.max()),2),'speed_p99':round(float(np.percentile(v.max(1),99)),2),'max_accel_mm_per_frame2':round(float(acc.max()),2),'accel_at_frame':int(acc.max(1).argmax())+1,'per_frame_max_accel':[round(float(x),2) for x in acc.max(1)]}
    res[clip]=r
json.dump(res,open(out,'w')); print('CDONE',json.dumps({c:{o:{k:v for k,v in d.items() if k!='per_frame_max_accel'} for o,d in r.items()} for c,r in res.items()}))
