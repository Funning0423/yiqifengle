# Applies the game's per-clip morph weights (anim_meta.json clips[clip].morph.curves, piecewise-linear in seconds,
# clamped to [0,1] exactly like CharacterMotion.morphWeights) to Blender shape keys on every frame change.
# Enable: env GAME_MORPH=<anim_meta.json>; load with --python game_morph.py before the main script.
import bpy,os,json
from bpy.app.handlers import persistent
META=os.environ.get('GAME_MORPH')
CURVES={}
if META:
    d=json.load(open(META)); CURVES={k:v.get('morph',{}).get('curves',{}) for k,v in d['clips'].items()}
def piece(c,t):
    if t<=c[0][0]: return c[0][1]
    for (t0,v0),(t1,v1) in zip(c,c[1:]):
        if t<=t1: return v0 if t1==t0 else v0+(v1-v0)*(t-t0)/(t1-t0)
    return c[-1][1]
def clip_of(act):
    for k in CURVES:
        if act.name==k or act.name.startswith(k+'_') or act.name.startswith(k+'.') : return k
    return None
@persistent
def apply(scene,*_):
    if not CURVES: return
    arm=[o for o in scene.objects if o.type=='ARMATURE']
    if not arm or not arm[0].animation_data or not arm[0].animation_data.action: return
    clip=clip_of(arm[0].animation_data.action); cur=CURVES.get(clip,{}) if clip else {}
    t=scene.frame_current/ (scene.render.fps/scene.render.fps_base)
    for o in scene.objects:
        if o.type!='MESH' or not o.data.shape_keys: continue
        if o.data.shape_keys.animation_data: o.data.shape_keys.animation_data.action=None
        for kb in o.data.shape_keys.key_blocks[1:]:
            w=piece(cur[kb.name],t) if kb.name in cur else 0.0
            kb.slider_min=0; kb.value=min(max(w,0.0),1.0)
    scene['game_morph_clip']=clip or ''
bpy.app.handlers.frame_change_pre.append(apply)
print('GAME_MORPH', META, len(CURVES))
