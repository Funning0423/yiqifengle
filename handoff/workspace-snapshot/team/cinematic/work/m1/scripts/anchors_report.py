"""Anchor errors (first/last frame of each clip), last-frame rest cleanliness, height measurements, bone count."""
import bpy, sys, json, math, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import clips
from mathutils import Vector
W='/workspace/wechat-game/team/cinematic/work/m1/'
bpy.ops.wm.open_mainfile(filepath=W+'scene/cine_m1_anim.blend')
a=bpy.data.objects['R5G2_RIG_22P4']
def g2b(p): return Vector((p[0],-p[2],p[1]))
ANCH={'seatedRoot(CharacterReference=R24 seated)':((0.4327299768730942,0,-4.207611558444886),-2.0),
      'standingRoot(CharacterReference)':((-0.016249,0,-4.413086),-2.0),'standingRoot(R24 Oi §4)':((-0.016163,0,-4.413051),-2.0),
      'turn end: standingRoot + walkYawRad':((-0.016249,0,-4.413086),-0.04937561571266458),
      'stand_up_foot_anchor (old foot ref, info only)':((-0.152,0,-4.2603),None),'turnStartFoot=return_path_15 (info only)':((-0.0561,0,-4.3498),None)}
def root_state():
    m=a.matrix_world@a.pose.bones['root'].matrix@a.data.bones['root'].matrix_local.inverted(); p=m.to_translation(); fw=m.to_3x3()@Vector((0,-1,0))  # remove root bone rest orientation; char forward = -Y
    yaw=math.atan2(fw.x,-fw.y); return p,yaw
def err(p,yaw,name):
    ap,ay=ANCH[name]; b=g2b(ap); d=(Vector((p.x,p.y,0))-Vector((b.x,b.y,0))).length
    out={'pos_err_mm':round(d*1000,3),'height_mm':round(p.z*1000,3)}
    if ay is not None: out['yaw_err_deg']=round(math.degrees((yaw-ay+math.pi)%(2*math.pi)-math.pi),4)
    return out
R={'clips':{}}
for clip,(f0,f1) in {'cine_open_stand':(0,90),'cine_open_turn':(0,45)}.items():
    clips.activate(clip); r={}
    for tag,f in (('first',f0),('last',f1)):
        bpy.context.scene.frame_set(f); p,y=root_state(); r[tag]={'frame':f,'root_game':[round(p.x,5),round(p.z,5),round(-p.y,5)],'yaw_rad':round(y,6),
            'vs':{n:err(p,y,n) for n in ANCH}}
    # last-frame rest: compare all non-root bones with rest (matrix_basis identity)
    bpy.context.scene.frame_set(f1); dev=0
    for pb in a.pose.bones:
        if pb.name=='root': continue
        q=pb.rotation_quaternion; d_=math.degrees(2*math.acos(min(1,abs(q.w))))
        if d_>dev: dev=d_; r['last_frame_worst_bone']=pb.name
    r['last_frame_max_bone_dev_from_rest_deg']=round(dev,3)
    sk=[bpy.data.objects[n].data.shape_keys.key_blocks['sit_corrective'].value for n in ('G2_DRESS_R5G2','G2_APRON_R5G2')]; r['last_frame_sit_corrective']=sk
    # hold: frames with no change before last
    R['clips'][clip]=r
# height at rest
for pb in a.pose.bones: pb.matrix_basis.identity()
for h in [a]+[bpy.data.objects[n].data.shape_keys for n in ('G2_DRESS_R5G2','G2_APRON_R5G2')]:
    if h.animation_data:
        for t in h.animation_data.nla_tracks: t.mute=True
for n in ('G2_DRESS_R5G2','G2_APRON_R5G2'): bpy.data.objects[n].data.shape_keys.key_blocks['sit_corrective'].value=0
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
b=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']; be=b.evaluated_get(dg); me=be.to_mesh()
mats=[m.name if m else '' for m in b.data.materials]; zs={}
used=set()
for poly in me.polygons:
    mn=mats[poly.material_index] if poly.material_index<len(mats) else ''
    for vi in poly.vertices: zs.setdefault(mn,[]).append((b.matrix_world@me.vertices[vi].co).z)
R['height']={'per_material_top_m':{k:round(max(v),4) for k,v in zs.items()},'feet_min_m':round(min(min(v) for v in zs.values()),4)}
hair=bpy.data.objects['G2_HAIR_BOB_R5G2']; he=hair.evaluated_get(dg); hm=he.to_mesh(); R['height']['hair_top_m']=round(max((hair.matrix_world@v.co).z for v in hm.vertices),4)
R['bones']={'total':len(a.data.bones),'deform':sum(1 for x in a.data.bones if x.use_deform),'cap':60}
R['root_scale']=[round(x,6) for x in a.matrix_world.to_scale()]
R['char_scale']=bpy.context.scene.get('char_scale'); R['char_scale_mode']=bpy.context.scene.get('char_scale_mode')
json.dump(R,open(W+'probe/anchors_v4.json','w'),indent=1); print('ANCH',json.dumps(R)[:3000])
