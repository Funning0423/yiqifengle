import bpy, numpy as np, json
from mathutils import Vector
G='/workspace/yiqifengle/previews/角色动画bot/planA-verify/hipsway/chr_b_r5g2_planA_hipsway65_cand1.glb'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=G)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]; PB=arm.pose.bones
for t in arm.animation_data.nla_tracks: t.mute=True
print('ACTS',[(a.name,tuple(a.frame_range)) for a in bpy.data.actions])
def setact(n):
    a=bpy.data.actions[n]; arm.animation_data.action=a
    try: arm.animation_data.action_slot=a.slots[0]
    except: pass
    return a
ms={o.name:o for o in bpy.data.objects if o.type=='MESH'}
def ev(o):
    dg=bpy.context.evaluated_depsgraph_get(); oe=o.evaluated_get(dg); me=oe.to_mesh(); M=oe.matrix_world
    V=np.array([tuple(M@v.co) for v in me.vertices]); oe.to_mesh_clear(); return V
a=setact('door_reach'); n=int(a.frame_range[1])
H={s:[] for s in 'LR'}
for f in range(n+1):
    sc.frame_set(f)
    for s in 'LR': H[s].append(tuple(arm.matrix_world@PB['hand.'+s].tail))
    if f%5==0:
        print('DR',f,'hips',[round(x,3) for x in arm.matrix_world@PB['hips'].head],'handL',[round(x,3) for x in H['L'][-1]],'handR',[round(x,3) for x in H['R'][-1]],'footL',[round(x,3) for x in arm.matrix_world@PB['foot.L'].head],'footR',[round(x,3) for x in arm.matrix_world@PB['foot.R'].head])
for s in 'LR':
    A=np.array(H[s]); v=np.linalg.norm(np.diff(A,axis=0),axis=1)*30; print('HAND',s,'travel',round(float(np.linalg.norm(A.max(0)-A.min(0))),3),'minY',A[:,1].min().round(3),'at',int(A[:,1].argmin()),'speed min after',[round(x,2) for x in v[::3]])
# widths over clips
for c in ('idle_breathing_loop','door_reach','walk_start','walk_loop'):
    a=setact(c); W=[]
    for f in range(0,int(a.frame_range[1])+1,2):
        sc.frame_set(f); hx=(arm.matrix_world@PB['hips'].head).x
        row={}
        for k in ('LOD0_G2_BODY','LOD0_G2_DRESS','LOD0_G2_APRON'):
            V=ev(ms[k]); row[k]=(V[:,0].min()-hx,V[:,0].max()-hx, V[:,2].min(), V[:,2].max(), V[:,1].min(),V[:,1].max())
        W.append(row)
    for k in ('LOD0_G2_BODY','LOD0_G2_DRESS','LOD0_G2_APRON'):
        print('W',c,k,'x',round(min(r[k][0] for r in W),3),round(max(r[k][1] for r in W),3),'z',round(min(r[k][2] for r in W),3),round(max(r[k][3] for r in W),3),'y',round(min(r[k][4] for r in W),3),round(max(r[k][5] for r in W),3))
