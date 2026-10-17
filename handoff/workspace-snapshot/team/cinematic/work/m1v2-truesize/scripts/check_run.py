import bpy, sys, json, time
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-truesize/scripts')
import checker as C, clips
from mathutils import Matrix, Vector
args=sys.argv[sys.argv.index('--')+1:]; blend=args[0]; out=args[1]; step=int(args[2]) if len(args)>2 else 1
bpy.ops.wm.open_mainfile(filepath=blend)
ck=C.Checker(); res={'clips':{},'controls':{}}
# layer baseline at REST
_arm=bpy.data.objects['R5G2_RIG_22P4']
for h in [_arm]+[bpy.data.objects[n].data.shape_keys for n in (C.BODY,C.DRESS,C.APRON) if bpy.data.objects[n].data.shape_keys]:
    if h.animation_data:
        h.animation_data.action=None
        for t in h.animation_data.nla_tracks: t.mute=True
for pb in _arm.pose.bones: pb.matrix_basis.identity()
for n in (C.BODY,C.DRESS,C.APRON):
    if bpy.data.objects[n].data.shape_keys is None: continue
    for kb in bpy.data.objects[n].data.shape_keys.key_blocks[1:]: kb.value=0
bpy.context.view_layer.update(); ck.set_layer_baseline(); res['layer_baseline_verts']=len(ck.layer_base)
for clip,n in clips.CLIPS.items():
    clips.activate(clip); rows=[]
    for f in list(range(0,n+1,step))+([n] if n%step else []):
        bpy.context.scene.frame_set(f); t=time.time(); r=ck.run(); rows.append({'frame':f,'pairs':r}); print('FRAME',clip,f,round(time.time()-t,1),flush=True)
    res['clips'][clip]=rows
# positive controls
arm=bpy.data.objects['R5G2_RIG_22P4']
def shifted(clip,f,dz):
    clips.activate(clip); bpy.context.scene.frame_set(f)
    h=arm.animation_data; tracks=[t for t in h.nla_tracks]
    for t in tracks: t.mute=True
    # freeze current pose: re-evaluate via frame then offset root by dz
    clips.activate(clip); bpy.context.scene.frame_set(f)
    pb=arm.pose.bones['root']; M=pb.matrix.copy()
    for t in tracks: t.mute=True
    pb.matrix=Matrix.Translation((0,0,dz))@M; bpy.context.view_layer.update()
    r=ck.run(garments_midsurface_too=False); clips.activate(clip); return r
r=shifted('cine_open_stand',0,-0.030)
res['controls']['seat_inject_-30mm_stand_f0']={k:v for k,v in r.items() if k.startswith(('chair:body','chair:dress','proxy:bodyxcol_int_chair_seat','ground:body'))}
r=shifted('cine_open_turn',45,-0.020)
res['controls']['ground_inject_-20mm_turn_f45']={k:v for k,v in r.items() if k.startswith('ground:')}
# layer-crossing control: push the apron 15 mm back into the dress at turn f45
clips.activate('cine_open_turn'); bpy.context.scene.frame_set(45); ap=bpy.data.objects[C.APRON]; M0=ap.matrix_world.copy()
yaw=-0.04937561571266458; import math
ap.matrix_world=Matrix.Translation(Vector((math.sin(yaw),-math.cos(yaw),0))*-0.015)@M0; bpy.context.view_layer.update()
dc,dt=ck.ev(C.DRESS,False); ac,at=ck.ev(C.APRON,False); b_,w_=ck.layer_cross(ac,ck.tree(dc,dt))
res['controls']['layer_inject_apron_back_15mm_turn_f45']={'layer_cross:apron_vs_dress':{'verts_inside':b_,'depth_mm':round(w_*1000,2)},'garment[midsurface]:apronxdress':{'tri_pairs':len(ck.tree(ac,at).overlap(ck.tree(dc,dt)))}}
ap.matrix_world=M0; bpy.context.view_layer.update()
# thin-sheet control: two synthetic crossing triangles (+ two adjacent ones that must NOT count)
import numpy as np
co=np.array([[0,0,0],[1,0,0],[0,1,0],[0.2,0.2,-0.5],[0.2,0.2,0.5],[0.4,0.4,0.0],[1,1,0]],float); tt=np.array([[0,1,2],[3,4,5],[1,6,2]])
res['controls']['thin_sheet_synthetic_crossing']={'expected':1,'found':C.Checker.self_pairs(co,tt)}
json.dump(res,open(out,'w'),indent=0)
print('DONE')
