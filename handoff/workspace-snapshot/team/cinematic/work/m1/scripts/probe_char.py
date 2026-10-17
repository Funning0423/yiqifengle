import bpy
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1/src_copy/B_R5G2_FIX_PASS2B_SOURCE_grokbot2.blend')
sc=bpy.context.scene
print("SCN",sc.name,sc.frame_start,sc.frame_end,sc.render.fps)
for o in bpy.data.objects:
    extra=''
    if o.type=='MESH':
        extra='v=%d mods=%s sk=%s vg=%d'%(len(o.data.vertices),[(m.type,m.name,getattr(m,'object',None) and m.object.name,m.show_viewport) for m in o.modifiers],[ (k.name,round(k.value,2)) for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else None,len(o.vertex_groups))
    print("OBJ",o.name,o.type,'par',o.parent.name if o.parent else None,'hide',o.hide_get(),o.hide_render,'loc',[round(x,4) for x in o.location],'sc',[round(x,5) for x in o.scale],'coll',[c.name for c in o.users_collection],extra)
for a in bpy.data.actions: print("ACT",a.name,tuple(a.frame_range),a.users)
for o in bpy.data.objects:
    if o.type=='ARMATURE':
        print("ARM",o.name,o.animation_data and o.animation_data.action, o.animation_data and [(t.name,t.mute,[s.action.name for s in t.strips]) for t in o.animation_data.nla_tracks])
        for b in o.data.bones: print("BONE",b.name,b.parent.name if b.parent else None,[round(x,4) for x in b.head_local],[round(x,4) for x in b.tail_local],round(b.roll if hasattr(b,'roll') else 0,3))
