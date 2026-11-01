exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
OUTD = os.environ['ROUT']; os.makedirs(OUTD, exist_ok=True)
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'OBJECT'; sh.show_cavity = True
for o in bpy.data.objects:
    if o.type == 'MESH': o.color = (0.82, 0.80, 0.74, 1)
O = {o.name: o for o in CH_MESH}
for n, col in (('LOD0_G2_DRESS', (0.95, 0.85, 0.25, 1)), ('LOD0_G2_APRON', (0.97, 0.97, 0.95, 1)), ('LOD0_G2_BOW', (0.6, 0.9, 1, 1)), ('LOD0_G2_BODY', (0.85, 0.72, 0.62, 1))): O[n].color = col
STOOL_MESH[0].color = (0.45, 0.33, 0.22, 1)
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam; cd.clip_start = .01
seat = Vector((0.4162, 4.2157, 0.44))
def shot(fn, loc, look, fov, W=480, H=640, hide=()):
    for o in hide: o.hide_render = True
    cam.location = loc; cam.rotation_euler = (look - loc).to_track_quat('-Z', 'Y').to_euler(); cd.angle = math.radians(fov)
    sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.filepath = OUTD + '/' + fn + '.png'; bpy.ops.render.render(write_still=True)
    for o in hide: o.hide_render = False
walls = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(('env_interior_shell', 'env_island', 'env_lighthouse', 'env_rear', 'env_interior_props'))]
def d(a): return Vector((math.cos(a), math.sin(a), 0))
SIDE = d(YAW); FRONT = d(YAW + math.pi / 2)
for c, fr in (('sit_down', range(15, 37, 3)), ('stand_up', range(0, 22, 3))):
    setclip(c)
    for f in fr:
        place(c, f); look = seat + Vector((0, 0, 0.15)); shot(f'{c}_f{f:02d}_side', look + SIDE * 2.2, look, 34, hide=walls)
setclip('sit_hold'); place('sit_hold', 0)
look = seat + Vector((0, 0, 0.12))
shot('hold_side', look + SIDE * 1.4, look, 40, hide=walls); shot('hold_otherside', look - SIDE * 1.4, look, 40, hide=walls)
shot('hold_front', look + FRONT * 1.4, look, 40, hide=walls); shot('hold_back', look - FRONT * 1.4, look, 40, hide=walls)
shot('hold_under', seat + Vector((0.35, -0.35, -0.38)), seat, 40, hide=walls)
shot('hold_game_camera', bl([-1.32022071, 1.38613379, -2.11374307]), bl([0.04, 1.22, -4.45]), 75, 750, 1624)
