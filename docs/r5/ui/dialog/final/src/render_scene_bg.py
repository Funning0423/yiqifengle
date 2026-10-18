# r5 U2 定稿底图：当前基线角色 + 岛场景，在 Blender 里按游戏「回家路上」跟拍机位重渲。
#  角色：A1 最终版 chr_b_r5g2_r5wrist_v4_final.glb（不可用时退回 bc81575f 的 chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb）
#  场景：bc81575f:creator-project/assets/firstslice/combined_visual_m.glb + combined_anchors_m.json（同 SHA 的工程资源）
#  机位：bc81575f RegionCameraData.TRANSITION_CAMERA.returnFollow（Mac r4 回家跟拍，enabled）—— FirstsliceRoutes.createFollowRig 的
#        out 参数 distance 2.3 / height 1.95 / targetHeight 0.86 / look 0 / fov 60（竖直），她走在 toThreshold（exit_path_17 + return_path_00..07）上。
#  光：WorldR5Integration.scene 的 Main Light（euler -30,-30,0，白光）+ 天空环境光；夜间是近似（月光 + 冷环境），不是游戏的夜间着色器。
# blender -b --factory-startup -P render_scene_bg.py -- out.png W H scale progress day|night [char.glb]
import bpy, sys, json, math, os
from mathutils import Vector
A = sys.argv[sys.argv.index('--') + 1:]
OUT, W, H, SC, Q, MODE = A[0], int(A[1]), int(A[2]), float(A[3]), float(A[4]), A[5]
CHAR = A[6] if len(A) > 6 else '/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb'
ISLAND = '/workspace/u2bg/combined_visual_m.glb'; ANCH = '/workspace/u2bg/anchors.json'
bpy.ops.wm.read_factory_settings(use_empty=True)
anch = {a['name']: a['position_world_m'] for a in json.load(open(ANCH))['anchors']}
route = [anch['exit_path_17']] + [anch['return_path_%02d' % i] for i in range(8)]
cum = [0.0]
for i in range(1, len(route)): cum.append(cum[-1] + math.hypot(route[i][0] - route[i-1][0], route[i][2] - route[i-1][2]))
L = cum[-1]; h0 = 1
while h0 < len(route) - 1 and cum[h0] < .05: h0 += 1
d0 = [(route[h0][0] - route[0][0]) / (cum[h0] or 1), (route[h0][2] - route[0][2]) / (cum[h0] or 1)]
def raw(s):
    if s <= 0: return (route[0][0] + d0[0] * s, route[0][2] + d0[1] * s)
    i = 1
    while i < len(route) - 1 and cum[i] < s: i += 1
    u = (s - cum[i-1]) / ((cum[i] - cum[i-1]) or 1); return (route[i-1][0] + (route[i][0] - route[i-1][0]) * u, route[i-1][2] + (route[i][2] - route[i-1][2]) * u)
def P(s, sm=0.6):
    w = sm / 2; x = z = ws = 0
    for k in range(-8, 9):
        q = 1 - abs(k) / 9; p = raw(s + w * k / 8); x += p[0] * q; z += p[1] * q; ws += q
    return (x / ws, z / ws)
RIG = dict(distance=2.3, height=1.95, targetHeight=0.86 + float(os.environ.get('TARGET_DY', '0')), look=0.0, fov=60.0)   # TARGET_DY：对话镜头建议（只在放不下 1 行的屏上用）
s = Q * L; lens = P(s - RIG['distance']); tgt = P(s + RIG['look']); root = raw(s)
a, b = raw(max(0, s - .2)), raw(min(L, s + .2)); tx, tz = b[0] - a[0], b[1] - a[1]; yaw = math.atan2(tx, tz)
cam_pos = (lens[0], RIG['height'], lens[1]); cam_tgt = (tgt[0], RIG['targetHeight'], tgt[1])
B = lambda p: Vector((p[0], -p[2], p[1]))
bpy.ops.import_scene.gltf(filepath=ISLAND)
for o in bpy.data.objects:
    if o.name.startswith('Icosphere') or o.name.startswith('env_int') or o.name in ('env_interior_props_merged', 'env_window_blind_cards'): o.hide_render = True
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=CHAR); new = [o for o in bpy.data.objects if o not in before]
for o in new:
    if o.name.startswith('Icosphere'): o.hide_render = True
piv = bpy.data.objects.new('char_pivot', None); bpy.context.scene.collection.objects.link(piv)
for o in new:
    if o.parent is None: o.parent = piv
piv.location = B((root[0], 0, root[1])); piv.rotation_euler = (0, 0, yaw)
arm = [o for o in new if o.type == 'ARMATURE']
act = bpy.data.actions.get('walk_loop')
if arm and act:
    arm[0].animation_data_create(); arm[0].animation_data.action = act
sc = bpy.context.scene; sc.frame_set(8)
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(RIG['fov']); cd.clip_start = 0.05; cd.clip_end = 400
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = B(cam_pos); d = B(cam_tgt) - B(cam_pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
sun = bpy.data.lights.new('sun', 'SUN'); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
ld = Vector((0.433, -0.5, -0.75))
so.rotation_euler = B(ld).to_track_quat('-Z', 'Y').to_euler(); sun.angle = math.radians(3)
if MODE == 'night':
    bg.inputs['Color'].default_value = (0.10, 0.16, 0.32, 1); bg.inputs['Strength'].default_value = 0.55
    sun.energy = 0.9; sun.color = (0.62, 0.72, 1.0)
else:
    # 白天（2026-10-18 修正）：原 sun 3.2 / 天空 0.9 + Standard → 黄裙子 88% 像素削顶。
    # 先试 AgX（光照不变）：不削顶了，但整体发灰（全图饱和度 104→75）、裙子褪成米黄 → 按退路改为
    # Standard + sun 1.9 / 天空 0.6（全图饱和度 107，裙子削顶 0%，亮/暗/褶皱分得开）。SUN/SKY/VIEW/EXPOSURE 环境变量可覆盖，复现对照用。
    bg.inputs['Color'].default_value = (0.70, 0.84, 1.0, 1); bg.inputs['Strength'].default_value = float(os.environ.get('SKY', '0.6'))
    sun.energy = float(os.environ.get('SUN', '1.9')); sun.color = (1.0, 0.97, 0.92)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', '48')); sc.cycles.use_denoising = True
# 视图变换：夜间保持 Standard 不动；白天最终也是 Standard（AgX 发灰，见上），VIEW=AgX / EXPOSURE=-1 可复现对照。
if MODE == 'night': sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = 0.0
else: sc.view_settings.view_transform = os.environ.get('VIEW', 'Standard'); sc.view_settings.exposure = float(os.environ.get('EXPOSURE', '0'))
sc.view_settings.look = 'None'
sc.render.resolution_x = round(W * SC); sc.render.resolution_y = round(H * SC); sc.render.resolution_percentage = 100
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
from bpy_extras.object_utils import world_to_camera_view
dg = bpy.context.evaluated_depsgraph_get(); xs = []; ys = []
for o in new:
    if o.type != 'MESH' or o.hide_render: continue
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    for v in me.vertices:
        p = world_to_camera_view(sc, cam, oe.matrix_world @ v.co); xs.append(p.x * W); ys.append((1 - p.y) * H)
    oe.to_mesh_clear()
bbox = [min(xs), min(ys), max(xs), max(ys)]
hp = world_to_camera_view(sc, cam, B((root[0], 1.45, root[1])))
info = dict(W=W, H=H, scale=SC, progress=Q, s_m=round(s, 3), route_len_m=round(L, 3), girl_root=[round(root[0], 4), 0, round(root[1], 4)], girl_yaw_deg=round(math.degrees(yaw), 2),
            camera=dict(position=[round(v, 4) for v in cam_pos], target=[round(v, 4) for v in cam_tgt], fovVerticalDeg=RIG['fov'], rig='TRANSITION_CAMERA.returnFollow.out' + (' + targetHeight %+.2f m (对话镜头建议)' % float(os.environ.get('TARGET_DY', '0')) if os.environ.get('TARGET_DY') else '')),
            girl_bbox_pt=[round(v, 1) for v in bbox], girl_head_pt=[round(hp.x * W, 1), round((1 - hp.y) * H, 1)], mode=MODE, char_glb=CHAR,
            island_glb='bc81575f:creator-project/assets/firstslice/combined_visual_m.glb', anim='walk_loop@8' if act else 'bind',
            light=dict(sun=round(sun.energy, 3), sky=round(bg.inputs['Strength'].default_value, 3), view_transform=sc.view_settings.view_transform, exposure=sc.view_settings.exposure, look=sc.view_settings.look))
json.dump(info, open(os.path.splitext(OUT)[0] + '.json', 'w'), indent=1, ensure_ascii=False); print('INFO', json.dumps(info, ensure_ascii=False))
bpy.ops.render.render(write_still=True); print('DONE', OUT)
