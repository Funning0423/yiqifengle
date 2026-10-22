# export walk_start_stepdown: frames F0..F1 of the baked getout (game time, 30 fps, play rate 1.0) as a single-clip preview GLB + meta
import bpy, json, os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); TAG = os.environ.get('TAG', 'sd3'); F0, F1 = 69, 121
bpy.ops.wm.open_mainfile(filepath=OUT + f'/{TAG}.blend')
Q = json.load(open(OUT + f'/qa_{TAG}.json')); R = Q['rows']; tl = Q['timeline']
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; src = arm.animation_data.action
new = bpy.data.actions.new('walk_start_stepdown')
for fc in src.fcurves:
    if not fc.data_path.startswith('pose.bones'): continue
    n = new.fcurves.new(fc.data_path, index=fc.array_index, action_group=fc.group.name if fc.group else '')
    for f in range(F0, F1 + 1): n.keyframe_points.insert(f - F0, fc.evaluate(f), options={'FAST'})
    for k in n.keyframe_points: k.interpolation = 'LINEAR'
for a in list(bpy.data.actions):
    if a is not new: bpy.data.actions.remove(a)
arm.animation_data_clear(); arm.animation_data_create(); arm.animation_data.action = new
try: arm.animation_data.action_slot = new.slots[0]
except Exception: pass
arm.location = (0, 0, 0); arm.rotation_euler = (0, 0, 0)
keep = {arm} | {o for o in bpy.data.objects if o.parent == arm or (o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers))}
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
bpy.context.scene.frame_start = 0; bpy.context.scene.frame_end = F1 - F0
fn = OUT + '/walk_start_stepdown_preview.glb'
bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_range=False, export_optimize_animation_size=False)
# root motion: forward along the route (incl. the +SFWD first step) and Y (relative to the board top = mooring 0.602)
s0 = R[F0]['s']
rm = [dict(t=round((f - F0) / 30, 4), forward_m=round(R[f]['s'] + R[f]['sx_mm'] / 1000 - s0, 5), y_m=round(R[f]['root_mm'] / 1000, 5)) for f in range(F0, F1 + 1)]
meta = dict(clip='walk_start_stepdown', fps=30, frames=F1 - F0 + 1, duration_s=round((F1 - F0) / 30, 4), play_rate=1.0, in_place=True,
            replaces='walk_start (rate 1.15) + its 0.2 s crossfade from door_reach and into walk_loop; the clip already contains both crossfades',
            entry=dict(from_clip='door_reach', door_reach_time_s=1.8, mode='hard cut (f0 == door_reach @1.8 s)'),
            exit=dict(to_clip='walk_loop', walk_loop_time_s=round((0.2 + (R[F1]['s'] - tl['s_ho']) / 0.7 * tl['warp']) % 1.433333, 4), mode='hard cut (last frame == walk_loop pose)', forward_m_at_end=rm[-1]['forward_m']),
            root_motion=rm, step=dict(drop_m=0.03, stride_extra_m=0.08, lead_foot='L (her right side, mirrored rig)', lead_plant_t=round((85 - F0) / 30, 4), trail_off_t=round((89 - F0) / 30, 4), trail_plant_t=round((109 - F0) / 30, 4)))
json.dump(meta, open(OUT + '/walk_start_stepdown_meta.json', 'w'), indent=1, ensure_ascii=False)
print('EXPORTED', fn)
