import bpy, sys, json, time
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1/scripts')
import checker as C, clips
from mathutils import Matrix, Vector
args=sys.argv[sys.argv.index('--')+1:]; blend=args[0]; out=args[1]; step=int(args[2]) if len(args)>2 else 1
bpy.ops.wm.open_mainfile(filepath=blend)
ck=C.Checker(); res={'clips':{},'controls':{}}
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
json.dump(res,open(out,'w'),indent=0)
print('DONE')
