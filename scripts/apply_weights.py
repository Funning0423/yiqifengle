"""rewrite the cine_open_stand shape-key keys (dress, apron, bow tails) from a sidecar weight schedule; bones untouched.
usage: blender -b --python apply_weights.py -- <in.blend> <sidecar.json> <out.blend>"""
import bpy, sys, json
a=sys.argv[sys.argv.index('--')+1:]; inb,side,outb=a[:3]
bpy.ops.wm.open_mainfile(filepath=inb)
W={int(k):v for k,v in json.load(open(side))['cine_open_stand_weights'].items()}
def fcurves(act):
    if hasattr(act,'fcurves'): return list(act.fcurves)
    return [f for l in act.layers for st in l.strips for cb in st.channelbags for f in cb.fcurves]
n=0
for on in ('G2_DRESS_R5G2','G2_APRON_R5G2','G2_BOW_TAILS_R5G2'):
    o=bpy.data.objects.get(on)
    if not o or not o.data.shape_keys or not o.data.shape_keys.animation_data: continue
    tr=[t for t in o.data.shape_keys.animation_data.nla_tracks if t.name=='cine_open_stand'][0]; act=tr.strips[0].action
    for fc in fcurves(act):
        kn=fc.data_path.split('"')[1]
        for kp in fc.keyframe_points:
            f=int(round(kp.co[0])); v=W.get(f,{}).get(kn,0.0); kp.co[1]=v; kp.handle_left[1]=v; kp.handle_right[1]=v; n+=1
        fc.update()
bpy.ops.wm.save_as_mainfile(filepath=outb); print('AW keys rewritten',n)
