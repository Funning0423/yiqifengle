"""Export M1 clips to GLB (armature + midsurface garments, shape keys kept) and re-import to verify."""
import bpy, sys, json, os
W='/workspace/wechat-game/team/cinematic/work/m1/'
out=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=W+'scene/cine_m1_anim.blend')
ARM='R5G2_RIG_22P4'; CH=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2']
a=bpy.data.objects[ARM]
# only cine tracks exported: remove old pass2 loop tracks from this export session (file not saved)
for h in [a]+[bpy.data.objects[n].data.shape_keys for n in CH if bpy.data.objects[n].data.shape_keys]:
    if h.animation_data:
        h.animation_data.action=None
        for t in list(h.animation_data.nla_tracks):
            if not t.name.startswith('cine_'): h.animation_data.nla_tracks.remove(t)
            else: t.mute=False
for n in CH:
    for m in bpy.data.objects[n].modifiers:
        if m.type=='SOLIDIFY': m.show_viewport=False; m.show_render=False   # game = midsurface double-sided
bpy.ops.object.select_all(action='DESELECT')
for n in [ARM]+CH: bpy.data.objects[n].select_set(True)
bpy.context.view_layer.objects.active=a
bpy.context.scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False, export_animations=True,
    export_animation_mode='NLA_TRACKS', export_morph=True, export_morph_animation=True, export_skins=True, export_all_influences=False,
    export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=False, export_def_bones=False, export_yup=True,
    export_cameras=False, export_lights=False)
# --- verify by re-import into an empty scene ---
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=out)
rep={'file':out,'bytes':os.path.getsize(out)}
arms=[o for o in bpy.data.objects if o.type=='ARMATURE']; rep['armatures']=[(o.name,len(o.data.bones),[round(x,6) for x in o.matrix_world.to_scale()]) for o in arms]
rep['meshes']=[(o.name,len(o.data.vertices),[k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else []) for o in bpy.data.objects if o.type=='MESH']
rep['actions']={}
for ac in bpy.data.actions:
    fr=ac.frame_range; rep['actions'][ac.name]={'frame_range':[fr[0],fr[1]],'fcurves':len(ac.fcurves),'morph_curves':sum(1 for f in ac.fcurves if 'key_blocks' in f.data_path or f.data_path=='value' or 'weights' in f.data_path)}
# max weights per vertex after import
mx=0
for o in bpy.data.objects:
    if o.type=='MESH':
        for v in o.data.vertices: mx=max(mx,len([g for g in v.groups if g.weight>0]))
rep['max_influences']=mx
json.dump(rep,open(out+'.reimport.json','w'),indent=1); print('REIMPORT',json.dumps(rep))
