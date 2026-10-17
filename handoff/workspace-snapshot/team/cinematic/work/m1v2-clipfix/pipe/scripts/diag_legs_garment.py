import bpy,sys,collections,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import clips, checker as C, poselib as P
from mathutils.bvhtree import BVHTree
from mathutils import Vector
ck=C.Checker(); a=bpy.data.objects['R5G2_RIG_22P4']
SK=[b.name for b in a.pose.bones if b.name.startswith('skirt')]
LEG=['thigh.L','shin.L','foot.L','thigh.R','shin.R','foot.R']
def count():
    bc,_=ck.ev(C.BODY,solid=False); dc,dt=ck.ev(C.DRESS,solid=False); ac,at=ck.ev(C.APRON,solid=False); T=ck.T
    D=BVHTree.FromPolygons([Vector(p) for p in dc],dt.tolist(),all_triangles=True); A=BVHTree.FromPolygons([Vector(p) for p in ac],at.tolist(),all_triangles=True)
    r={}
    for s in ('legL','legR'):
        L=BVHTree.FromPolygons([Vector(p) for p in bc],T[ck.parts[s]].tolist(),all_triangles=True); r[s+'xdress']=len(L.overlap(D)); r[s+'xapron']=len(L.overlap(A))
    return r
def sk(v):
    for n in (C.DRESS,C.APRON):
        kb=bpy.data.objects[n].data.shape_keys
        if kb and 'sit_corrective' in kb.key_blocks: kb.key_blocks['sit_corrective'].value=v
ad=a.animation_data; m0=[t.mute for t in ad.nla_tracks]; act0=ad.action
for t in ad.nla_tracks: t.mute=True
ad.action=None; P.reset(); P.apply_list(P.SIT); P.upd(); SITM={b.name:b.matrix_basis.copy() for b in a.pose.bones}
for t,m in zip(ad.nla_tracks,m0): t.mute=m
ad.action=act0
for f in (0,20,40,60):
    clips.activate('cine_open_stand'); bpy.context.scene.frame_set(f)
    base=count()
    # detach action evaluation: snapshot pose, then disable NLA so manual edits stick
    snap={b.name:b.matrix_basis.copy() for b in a.pose.bones}
    ad=a.animation_data; mutes=[t.mute for t in ad.nla_tracks]; act=ad.action
    for t in ad.nla_tracks: t.mute=True
    ad.action=None
    for b in a.pose.bones: b.matrix_basis=snap[b.name]
    cur_sk=[bpy.data.objects[n].data.shape_keys.key_blocks['sit_corrective'].value for n in (C.DRESS,C.APRON)]
    # B: legs to pass2b SIT FK
    for b in LEG: a.pose.bones[b].matrix_basis=SITM[b].copy()
    bpy.context.view_layer.update(); legsit=count()
    for b in LEG: a.pose.bones[b].matrix_basis=snap[b]
    # C: skirt fully released (bones REST, morph 0), legs as animated
    for b in SK: a.pose.bones[b].matrix_basis.identity()
    sk(0.0); bpy.context.view_layer.update(); rel=count()
    # D: skirt in full sit (bones SIT, morph 1)
    for b in SK: a.pose.bones[b].matrix_basis=SITM[b].copy()
    sk(1.0); bpy.context.view_layer.update(); sitsk=count()
    for b in a.pose.bones: b.matrix_basis=snap[b.name]
    for t,m in zip(ad.nla_tracks,mutes): t.mute=m
    ad.action=act
    print('LD',f,'anim',base,'| legs=pass2bSIT',legsit,'| skirt released',rel,'| skirt full sit',sitsk)
