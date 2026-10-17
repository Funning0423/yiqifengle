import bpy,sys,json
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-pass2c/scripts'); import checker as C
blend,out=sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.open_mainfile(filepath=blend); arm=bpy.data.objects['R5G2_RIG_22P4']
for h in [arm]+[bpy.data.objects[n].data.shape_keys for n in (C.BODY,C.DRESS,C.APRON)]:
    if h and h.animation_data:
        h.animation_data.action=None
        for t in h.animation_data.nla_tracks: t.mute=True
for pb in arm.pose.bones: pb.matrix_basis.identity()
for n in (C.BODY,C.DRESS,C.APRON):
    for kb in bpy.data.objects[n].data.shape_keys.key_blocks[1:]: kb.value=0
bpy.context.view_layer.update(); ck=C.Checker(); ck.set_layer_baseline(); r=ck.run()
json.dump({k:v for k,v in r.items() if not k.startswith(('chair','proxy','ground'))},open(out,'w'),indent=1); print('DONE')
