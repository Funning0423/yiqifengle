import bpy
CLIPS={'cine_open_stand':90,'cine_open_turn':45,'cine_open_safe_end':0,'cine_home_safe_end':0}
def activate(name):
    holders=[bpy.data.objects['R5G2_RIG_22P4']]+[bpy.data.objects[n].data.shape_keys for n in ('B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_BOW_TAILS_R5G2') if n in bpy.data.objects and bpy.data.objects[n].data.shape_keys]
    for h in holders:
        if h.animation_data:
            h.animation_data.action=None
            for t in h.animation_data.nla_tracks: t.mute=(t.name!=name)
        if hasattr(h,'update_tag'): h.update_tag(refresh={'OBJECT','DATA','TIME'}) if isinstance(h,bpy.types.Object) else h.update_tag()
    sc=bpy.context.scene; sc.frame_start=0; sc.frame_end=CLIPS[name]
    # force re-evaluation (v1 bug: first frame after switching was evaluated with the previous track state)
    sc.frame_set(CLIPS[name]+1); sc.frame_set(0); bpy.context.view_layer.update()
