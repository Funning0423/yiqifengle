"""v3 cs step 1: per-frame linear skin map (world = A_f,v @ rest + t_f,v) for dress/apron midsurface, original rest shapes R0 per frame,
body (incl. bow obj) world coords per frame, static real chair, rest-pose dress/apron for the apron-vs-dress layer baseline.
usage: blender -b --python precompute.py -- <blend> <out.npz>"""
import bpy, sys, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; blend,out=a[:2]
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import checker as C, clips
bpy.ops.wm.open_mainfile(filepath=blend); ck=C.Checker(); sc=bpy.context.scene
OB=[C.DRESS,C.APRON]; D={}
def arr(kb,n): x=np.empty(n*3); kb.data.foreach_get('co',x); return x.reshape(-1,3)
info={}
for on in OB:
    me=bpy.data.objects[on].data; ks=me.shape_keys; n=len(me.vertices)
    for kb in ks.key_blocks[1:]: assert kb.relative_key.name==ks.key_blocks[0].name and not kb.vertex_group, (on,kb.name)
    if 'probe' not in ks.key_blocks: bpy.data.objects[on].shape_key_add(name='probe',from_mix=False)
    info[on]=dict(n=n,basis=arr(ks.key_blocks[0],n),keys={kb.name:arr(kb,n) for kb in ks.key_blocks[1:] if kb.name!='probe'})
def mute(on,m):
    k=bpy.data.objects[on].data.shape_keys
    for t in k.animation_data.nla_tracks: t.mute=True if m else (t.name!='cine_open_stand')
clips.activate('cine_open_stand'); NF=91; EPS=0.01
for on in OB:
    n=info[on]['n']; D[on+'_A']=np.zeros((NF,n,3,3),np.float64); D[on+'_t']=np.zeros((NF,n,3)); D[on+'_R0']=np.zeros((NF,n,3)); D[on+'_X0']=np.zeros((NF,n,3)); D[on+'_W']=[]
BX=[]; err=0
for f in range(NF):
    for on in OB: mute(on,False)
    sc.frame_set(f); bpy.context.view_layer.update()
    bc,bt=ck.ev(C.BODY); BX.append(bc.astype(np.float32))
    for on in OB:
        ks=bpy.data.objects[on].data.shape_keys; I=info[on]
        D[on+'_X0'][f]=ck.ev(on,False)[0]
        w={kb.name:kb.value for kb in ks.key_blocks[1:] if kb.name!='probe' and kb.value>1e-7}
        R=I['basis'].copy()
        for k,v in w.items(): R+=v*(I['keys'][k]-I['basis'])
        D[on+'_R0'][f]=R; D[on+'_W'].append(repr(w))
    for on in OB:
        mute(on,True); ks=bpy.data.objects[on].data.shape_keys
        for kb in ks.key_blocks[1:]: kb.value=0.0
        ks.key_blocks['probe'].value=1.0
    def evp(offs):
        for on in OB:
            kp=bpy.data.objects[on].data.shape_keys.key_blocks['probe']; kp.data.foreach_set('co',(info[on]['basis']+offs).ravel()); bpy.data.objects[on].data.update()
        sc.frame_set(f); bpy.context.view_layer.update()
        return {on:ck.ev(on,False)[0] for on in OB}
    X0=evp(np.zeros(3)); cols=[evp(np.eye(3)[i]*EPS) for i in range(3)]
    for on in OB:
        A=np.stack([(cols[i][on]-X0[on])/EPS for i in range(3)],axis=2)   # (n,3,3) columns
        t=X0[on]-np.einsum('nij,nj->ni',A,info[on]['basis'])
        D[on+'_A'][f]=A; D[on+'_t'][f]=t
        e=np.abs(np.einsum('nij,nj->ni',A,D[on+'_R0'][f])+t-D[on+'_X0'][f]).max(); err=max(err,e)
    for on in OB: bpy.data.objects[on].data.shape_keys.key_blocks['probe'].value=0.0
    print('PRE',f,'maxerr_mm',round(err*1000,4),flush=True)
D['body_X']=np.array(BX); D['body_T']=ck.T; D['body_nobow_tris']=ck.parts['body_nobow']; D['body_torso_tris']=ck.parts['torso']
D['bow_tris']=ck.parts['bow']
for p in ('legL','legR','handL','handR','armL','armR','uarmL','uarmR','head'): D['part_'+p]=ck.parts[p]
cco,ctri,_,_=ck.chair; D['chair_X']=cco; D['chair_T']=ctri
for on in OB:
    _,t=ck.ev(on,False); D[on+'_T']=t
# rest pose (same as check_run baseline)
arm=bpy.data.objects['R5G2_RIG_22P4']
for h in [arm]+[bpy.data.objects[n].data.shape_keys for n in (C.BODY,C.DRESS,C.APRON,'G2_BOW_TAILS_R5G2') if n in bpy.data.objects and bpy.data.objects[n].data.shape_keys]:
    if h.animation_data:
        h.animation_data.action=None
        for t in h.animation_data.nla_tracks: t.mute=True
for pb in arm.pose.bones: pb.matrix_basis.identity()
for n in (C.BODY,C.DRESS,C.APRON,'G2_BOW_TAILS_R5G2'):
    if n in bpy.data.objects and bpy.data.objects[n].data.shape_keys:
        for kb in bpy.data.objects[n].data.shape_keys.key_blocks[1:]: kb.value=0
bpy.context.view_layer.update()
for on in OB: D[on+'_rest']=ck.ev(on,False)[0]
for on in OB:
    D[on+'_basis']=info[on]['basis']; D[on+'_W']=np.array(D[on+'_W'])
np.savez(out,**D); print('PREDONE maxerr_mm',err*1000)
