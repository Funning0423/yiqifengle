# U3 加载页底图：bc81575f 生产资源在 Blender 里搭场景（房间 + 圆凳 + 生产版角色 sit_hold 第 0 帧 + anim_meta 的 morph 权重）。
# 被 u3_probe.py（穿模检测）和 u3_render.py（出图）exec。环境变量：U3_SRC（资源目录）、U3_DX/U3_DY/U3_DZ（根位置微调，Cocos m，默认 0）
import bpy, os, json, math, mathutils
SRC = os.environ.get('U3_SRC', '/workspace/u3/src')
ROOM = SRC + '/room_no_original_chair.glb'                 # bc81575f:creator-build-project/assets/bundles/static_seat_preview/room/
STOOL = SRC + '/reading_chair.glb'                          # bc81575f:.../region_island/character_support/reading_chair.glb
CHAR = os.environ.get('U3_CHAR', SRC + '/char_prod.glb')    # bc81575f:.../region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb
META = SRC + '/creator-build-project/assets/bundles/region_island/character/anim_meta.json'
SEATED_ROOT = [0.4327299768730942, 0.0, -4.207611558444886]   # CharacterReference.seatedRoot
YAW = -2.0                                                      # seatYawRad
SEAT_ANCHOR = [0.4203000068664551, 0.3799999952316284, -4.2133002281188965]  # FirstsliceFacts seat_anchor
DROOT = [float(os.environ.get('U3_DX', 0)), float(os.environ.get('U3_DY', 0)), float(os.environ.get('U3_DZ', 0))]
def bl(v): return mathutils.Vector((v[0], -v[2], v[1]))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def imp(p):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=p); return [o for o in bpy.data.objects if o not in before]
roomobjs = imp(ROOM); stoolobjs = imp(STOOL); chobjs = imp(CHAR)
def holder(name, objs):
    h = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(h)
    for r in [o for o in objs if o.parent is None]: r.parent = h
    return h
# 圆凳：WorldIntegrationBoot.mountWorld —— scale 1.2, sx .00037, sz -.09094, yaw -2, y .000126
sc_, sx, sz = 1.2, .00037, -.09094; a = SEAT_ANCHOR
stool_pos = [a[0] - sc_ * (math.cos(YAW) * sx + math.sin(YAW) * sz), .000126, a[2] - sc_ * (-math.sin(YAW) * sx + math.cos(YAW) * sz)]
hs = holder('stool_holder', stoolobjs); hs.location = bl(stool_pos); hs.rotation_euler = (0, 0, YAW); hs.scale = (sc_,) * 3
# 角色：根 = seatedRoot（+ 微调），朝向 -2 rad，scale 1（WorldIntegrationBoot: girl.setScale(1,1,1)，unit-scale visual）
root = [SEATED_ROOT[i] + DROOT[i] for i in range(3)]
hc = holder('chr_holder', chobjs); hc.location = bl(root); hc.rotation_euler = (0, 0, YAW); hc.scale = (1, 1, 1)
for o in chobjs:
    if o.name.startswith('Icosphere'): o.hide_render = True; o.hide_viewport = True
arm = [o for o in chobjs if o.type == 'ARMATURE'][0]
sc = bpy.context.scene
act = bpy.data.actions.get('sit_hold') or next(x for x in bpy.data.actions if x.name.startswith('sit_hold'))
arm.animation_data_create(); arm.animation_data.action = act
try:
    if act.slots: arm.animation_data.action_slot = act.slots[0]
except Exception: pass
for o in chobjs:
    if o is arm or o.type != 'MESH': continue
    sk = o.data.shape_keys
    if sk and sk.animation_data: sk.animation_data.action = None
a0, a1 = act.frame_range; sc.frame_set(int(a0))
meta = json.load(open(META)); curves = meta['clips']['sit_hold']['morph']['curves']
W0 = {k: v[0][1] for k, v in curves.items()}
set_keys = []
for o in chobjs:
    sk = o.data.shape_keys if o.type == 'MESH' else None
    if not sk: continue
    for kb in sk.key_blocks[1:]:
        kb.value = W0.get(kb.name, 0.0)
        if kb.value: set_keys.append((o.name, kb.name, kb.value))
bpy.context.view_layer.update()
CH_MESH = [o for o in chobjs if o.type == 'MESH' and not o.hide_render]
STOOL_MESH = [o for o in stoolobjs if o.type == 'MESH']
INFO = dict(char_glb=CHAR, clip=act.name, frame=a0, frame_range=[a0, a1], morph=set_keys, seated_root=root, droot=DROOT, yaw=YAW, stool_pos=stool_pos, stool_scale=sc_,
            char_meshes=[o.name for o in CH_MESH], stool_meshes=[o.name for o in STOOL_MESH])
print('U3SCENE', json.dumps(INFO))
