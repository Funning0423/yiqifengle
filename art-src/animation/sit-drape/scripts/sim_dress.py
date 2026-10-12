# Stage 1 (Blender cloth): physically settled seated dress, used as the TARGET shape for the skirt bones + shape keys.
#   blender -b -P sim_dress.py -- <out.npz> [settle_frames]
# Timeline (30 fps, seated-root frame, glTF z = her forward):
#   idle_breathing_loop t=0 held at the standing root (0.494 m in front of the seated root) for PRE frames,
#   sit_down 0..1.2 s while the root slides back to the seated root (anim_meta root_motion.forward_m, = the driver),
#   sit_hold t=0 held for SETTLE frames.
# Cloth: position-welded copy of LOD0_G2_DRESS (UV / normal seams joined), pinned by its non-skirt skin weight (waistband),
# colliders = LOD0_G2_BODY (armature-deformed), the room chair (env_int_prop_reading_chair from combined_visual_m.glb), floor.
# Output: settled dress vertex positions per ORIGINAL dress vertex, glTF axes, seated root frame; plus a few mid-sit frames.
import bpy, bmesh, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from mathutils import Vector, Matrix
import sdlib as S

a = sys.argv[sys.argv.index('--') + 1:]
OUT = a[0]
SETTLE = int(a[1]) if len(a) > 1 else 70
PRE = 12
SIT_N = 36                    # sit_down frames (1.2 s)
GLB = os.environ.get('SD_GLB', S.GLB)
meta = json.load(open(os.path.join(S.CHR, 'anim_meta.json')))
fwd_curve = np.array(meta['clips']['sit_down']['root_motion']['forward_m'])
STAND_Z = -fwd_curve[-1, 1]   # 0.494

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = S.FPS
CV, CF = S.extract_chair()
ch = S.Character(GLB)
chair = S.make_mesh_object('chair', S.gl2bl(S.chair_in_seated_root(CV)), CF)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.object

# ---- timeline: bake (clip, t, root_z) per scene frame into one action
plan = []
for f in range(PRE):
    plan.append(('idle_breathing_loop', 0.0, STAND_Z))
for i in range(SIT_N + 1):
    t = i / S.FPS
    plan.append(('sit_down', t, STAND_Z + float(np.interp(t, fwd_curve[:, 0], fwd_curve[:, 1]))))
for f in range(SETTLE):
    plan.append(('sit_hold', 0.0, 0.0))
arm = ch.arm
poses = []
for clip, t, rz in plan:
    ch.pose(clip, t)
    poses.append({pb.name: (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy()) for pb in arm.pose.bones})
act = bpy.data.actions.new('sim_timeline')
arm.animation_data.action = act
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
for fi, (pz, (clip, t, rz)) in enumerate(zip(poses, plan)):
    f = fi + 1
    for pb in arm.pose.bones:
        l, q, s = pz[pb.name]
        pb.location, pb.rotation_quaternion, pb.scale = l, q, s
        pb.keyframe_insert('location', frame=f)
        pb.keyframe_insert('rotation_quaternion', frame=f)
    ch.top.location = Vector((0, -rz, 0))
    ch.top.keyframe_insert('location', frame=f)
NF = len(plan)
sc.frame_start, sc.frame_end = 1, NF

# ---- cloth object: welded copy of the dress
src = ch.mesh['LOD0_G2_DRESS']
dress = src.copy()
dress.data = src.data.copy()
dress.name = 'DRESS_SIM'
sc.collection.objects.link(dress)
src.hide_render = True
src.hide_viewport = True
bm = bmesh.new()
bm.from_mesh(dress.data)
nv0 = len(bm.verts)
co0 = np.array([tuple(v.co) for v in bm.verts])
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(dress.data)
bm.free()
cow = np.array([tuple(v.co) for v in dress.data.vertices])
from scipy_free_nn import nearest  # noqa: E402  (tiny numpy NN helper, no scipy inside Blender)
mapping = nearest(cow, co0)
print('SIM weld', nv0, '->', len(cow))
# pin group from skin: weight of non-skirt bones (hips) -> waistband pinned, panels free
gi = {g.index: g.name for g in dress.vertex_groups}
pin = dress.vertex_groups.new(name='_pin')
for v in dress.data.vertices:
    w = sum(g.weight for g in v.groups if not gi[g.group].startswith('skirt'))
    tot = sum(g.weight for g in v.groups) or 1
    pv = min(1.0, max(0.0, (w / tot - 0.35) / 0.4))
    if pv > 0:
        pin.add([v.index], pv, 'REPLACE')
cl = dress.modifiers.new('Cloth', 'CLOTH')
cs = cl.settings
cs.quality = 12
cs.mass = 0.2
cs.air_damping = 2.0
cs.tension_stiffness = 30
cs.compression_stiffness = 30
cs.shear_stiffness = 15
cs.bending_stiffness = float(os.environ.get('SD_BEND', '4.0'))   # stiff: few broad folds (low-poly look), not crumples
cs.tension_damping = 8
cs.compression_damping = 8
cs.bending_damping = 0.5
cs.vertex_group_mass = '_pin'
cs.pin_stiffness = 1.0
cc = cl.collision_settings
cc.collision_quality = 4
cc.distance_min = 0.004
cc.use_self_collision = True
cc.self_distance_min = 0.003
cc.self_friction = 5
cl.point_cache.frame_start = 1
cl.point_cache.frame_end = NF
for ob, d in ((ch.mesh['LOD0_G2_BODY'], 0.006), (chair, 0.004), (floor, 0.004)):
    m = ob.modifiers.new('Collision', 'COLLISION')
    ob.collision.thickness_outer = d
    ob.collision.thickness_inner = 0.02
    ob.collision.cloth_friction = float(os.environ.get('SD_FRIC', '8.0')) if ob is not floor else 8.0
    ob.collision.damping = 0.5

out = {}
keep_frames = {PRE + 1 + int(round(t * S.FPS)): 'sit_down_%.3f' % t for t in (0.4, 0.6, 0.8667, 1.0, 1.2)}
for f in range(1, NF + 1):
    sc.frame_set(f)
    if f in keep_frames or f == NF:
        dg = bpy.context.evaluated_depsgraph_get()
        ev = dress.evaluated_get(dg)
        m = ev.to_mesh()
        V = np.array([tuple(dress.matrix_world @ v.co) for v in m.vertices])
        ev.to_mesh_clear()
        rz = plan[f - 1][2]
        Vg = S.bl2gl(V)
        Vg[:, 2] -= rz                      # character-root frame (same as the seated frame at the end)
        key = keep_frames.get(f, 'settled')
        out[key] = Vg[mapping]
        print('SIM frame', f, key, flush=True)
np.savez(OUT, **out)
print('SIM saved', OUT, list(out))
