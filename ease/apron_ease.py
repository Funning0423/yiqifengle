"""v4: SRC + apron-only ease of the sit_corrective -> m1_c07 transition (cine_open_stand).
SRC: sit=1 f0-5, 0.5 f6, 0 f7 (c07 = 1-sit). Ease: smoothstep from f2 (sit 1) to f7 (sit 0) on the apron only.
Dress, bow, bones, all other frames untouched.
usage: blender -b --python apron_ease.py -- <src.blend> <out.blend> <out_weights.json>"""
import bpy, sys, json
a=sys.argv[sys.argv.index('--')+1:]; inb,outb,outj=a[:3]
bpy.ops.wm.open_mainfile(filepath=inb)
def ss(t): return t*t*(3-2*t)
SIT={f:round(1-ss((f-2)/5),6) for f in (3,4,5,6)}
def fcurves(act):
    if hasattr(act,'fcurves'): return list(act.fcurves)
    return [f for l in act.layers for st in l.strips for cb in st.channelbags for f in cb.fcurves]
o=bpy.data.objects['G2_APRON_R5G2']; tr=[t for t in o.data.shape_keys.animation_data.nla_tracks if t.name=='cine_open_stand'][0]; act=tr.strips[0].action
log={}
for fc in fcurves(act):
    kn=fc.data_path.split('"')[1]
    if kn not in ('sit_corrective','m1_c07'): continue
    for f,s in SIT.items():
        v=s if kn=='sit_corrective' else 1-s
        kp=[k for k in fc.keyframe_points if int(round(k.co[0]))==f]
        old=kp[0].co[1] if kp else fc.evaluate(f)
        if not kp: fc.keyframe_points.insert(f,v); kp=[k for k in fc.keyframe_points if int(round(k.co[0]))==f]
        k=kp[0]; k.co[1]=v; k.handle_left[1]=v; k.handle_right[1]=v; k.interpolation='LINEAR'
        log.setdefault(kn,{})[f]={'src':round(old,4),'ease':round(v,4)}
    fc.update()
bpy.ops.wm.save_as_mainfile(filepath=outb); json.dump({'object':'G2_APRON_R5G2','clip':'cine_open_stand','changes':log},open(outj,'w'),indent=1); print('EASE',json.dumps(log))
