# 穿模证据：深度统计 + Workbench 局部放大（红 = 和圆凳表面相交的角色三角形）
import bpy, os, json, math, mathutils
from mathutils.bvhtree import BVHTree
exec(open('/workspace/u3/tools/u3_scene.py').read())
OUTD = os.environ.get('U3_EVD', '/workspace/u3/work/evidence'); os.makedirs(OUTD, exist_ok=True)
dg = bpy.context.evaluated_depsgraph_get()
def wm(o):
    oe = o.evaluated_get(dg); me = oe.to_mesh(); M = oe.matrix_world.copy(); vs = [M @ v.co for v in me.vertices]; me.calc_loop_triangles()
    t = [tuple(x.vertices) for x in me.loop_triangles]; oe.to_mesh_clear(); return vs, t
sv, stt = wm(STOOL_MESH[0]); bo = BVHTree.FromPolygons(sv, stt)
cx = sum(v.x for v in sv) / len(sv); cy = sum(v.y for v in sv) / len(sv); top = max(v.z for v in sv)
def rad_at(z):
    r = [math.hypot(v.x - cx, v.y - cy) for v in sv if abs(v.z - z) < 0.01]; return max(r) if r else 0
prof = {round(z, 2): rad_at(z) for z in [i / 100 for i in range(0, 45)]}
stats = {}
hit_v, hit_t = [], []
for o in CH_MESH:
    cv, ct = wm(o); b = BVHTree.FromPolygons(cv, ct); pairs = b.overlap(bo)
    seat_r = rad_at(top - 0.005)
    under = [top - v.z for v in cv if math.hypot(v.x - cx, v.y - cy) < seat_r - 0.01 and v.z < top - 1e-4 and v.z > 0.05]
    side = []
    for v in cv:
        if 0.02 < v.z < top - 0.005:
            r = math.hypot(v.x - cx, v.y - cy); R = prof.get(round(v.z, 2), 0)
            if r < R: side.append(R - r)
    stats[o.name] = dict(tri_intersections=len(pairs), verts_below_seat_top_inside_disc=len(under), max_depth_below_seat_top_m=round(max(under), 4) if under else 0,
                         verts_inside_stool_radius=len(side), max_radial_depth_m=round(max(side), 4) if side else 0)
    for ci in set(p[0] for p in pairs):
        base = len(hit_v); hit_v += [cv[i] for i in ct[ci]]; hit_t.append((base, base + 1, base + 2))
stats['stool'] = dict(top_z_m=round(top, 4), center_bl=[round(cx, 4), round(cy, 4)], seat_radius_m=round(rad_at(top - 0.005), 4), open_mesh_boundary_edges=918)
json.dump(dict(info=INFO, stats=stats), open(OUTD + '/penetration_stats.json', 'w'), indent=1, ensure_ascii=False)
print('STATS', json.dumps(stats, ensure_ascii=False))
me = bpy.data.meshes.new('hits'); me.from_pydata([tuple(v) for v in hit_v], [], hit_t); hit = bpy.data.objects.new('HITS', me); bpy.context.scene.collection.objects.link(hit)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading
sh.light = 'STUDIO'; sh.color_type = 'OBJECT'; sh.show_shadows = False; sh.show_cavity = True
for o in bpy.data.objects:
    if o.type == 'MESH': o.color = (0.82, 0.80, 0.74, 1)
for o in CH_MESH: o.color = {'LOD0_G2_DRESS': (0.95, 0.85, 0.25, 1), 'LOD0_G2_APRON': (0.97, 0.97, 0.95, 1), 'LOD0_G2_BOW': (0.6, 0.9, 1.0, 1)}.get(o.name, (0.85, 0.72, 0.62, 1))
STOOL_MESH[0].color = (0.45, 0.33, 0.22, 1); hit.color = (1, 0.05, 0.05, 1)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.clip_start = 0.01
seat = mathutils.Vector((cx, cy, top))
def shot(name, loc, look, fov_deg, W=900, H=900, hide=()):
    for o in hide: o.hide_render = True
    cam.location = loc; d = (look - loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cd.angle = math.radians(fov_deg)
    sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.filepath = OUTD + '/' + name + '.png'; bpy.ops.render.render(write_still=True)
    for o in hide: o.hide_render = False
# 游戏 home 机位（RegionCameraData sitting-room）
homep = bl([-1.32022071, 1.38613379, -2.11374307]); homet = bl([0.04, 1.22, -4.45])
shot('A_home_camera', homep, homet, 75, 750, 1624)
dirh = (seat - homep).normalized()
shot('B_home_dir_zoom', seat - dirh * 1.1 + mathutils.Vector((0, 0, 0.05)), seat + mathutils.Vector((0, 0, -0.02)), 30)
fwd = mathutils.Vector((math.sin(-YAW) * 0 + math.cos(YAW + math.pi / 2), math.sin(YAW + math.pi / 2), 0))
for k, ang in (('C_side_left', 0.0), ('D_side_right', math.pi), ('E_back', -math.pi / 2), ('F_front', math.pi / 2)):
    dv = mathutils.Vector((math.cos(YAW + ang), math.sin(YAW + ang), 0))
    shot(k, seat + dv * 1.0 + mathutils.Vector((0, 0, 0.02)), seat + mathutils.Vector((0, 0, -0.03)), 32)
shot('G_side_stool_hidden', seat + mathutils.Vector((math.cos(YAW), math.sin(YAW), 0)) * 1.0 + mathutils.Vector((0, 0, 0.02)), seat + mathutils.Vector((0, 0, -0.03)), 32, hide=STOOL_MESH)
shot('H_below_seat_up', seat + mathutils.Vector((0.35, -0.35, -0.38)), seat, 40, hide=[o for o in bpy.data.objects if o.name.startswith('env_interior_shell') or o.name.startswith('env_island')])
print('SHOTS_DONE')
