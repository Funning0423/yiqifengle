# blender -b -P render_seated.py -- <glb> <out_prefix> <clip> <t_s> [views] [res_h] [sit_drape] [engine] [sit_drape_mid]
# Seated preview with the room chair: renders <out_prefix>_<view>.png.  shape_weight is written to every shape key of
# LOD0_G2_DRESS / LOD0_G2_APRON whose name starts with sit_drape (anim_meta curve value at that time).
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import sdlib as S
import render_lib as R

a = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT, CLIP, T = a[0], a[1], a[2], float(a[3])
VIEWS = (a[4] if len(a) > 4 else 'side,front,q34,back').split(',')
RES = int(a[5]) if len(a) > 5 else 600
SW = float(a[6]) if len(a) > 6 else 1.0
ENGINE = a[7] if len(a) > 7 else 'workbench'
SWM = float(a[8]) if len(a) > 8 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
CV, CF = S.extract_chair()
ch = S.Character(GLB)
S.make_mesh_object('chair', S.gl2bl(S.chair_in_seated_root(CV)), CF, R.flat_material('wood', (0.55, 0.38, 0.25)))
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
bpy.context.object.data.materials.append(R.flat_material('floor', (0.42, 0.40, 0.37)))
for n in ('LOD0_G2_DRESS', 'LOD0_G2_APRON'):
    o = ch.mesh[n]
    if o.data.shape_keys:
        for kb in o.data.shape_keys.key_blocks[1:]:
            kb.value = SW if kb.name == 'sit_drape' else (SWM if kb.name == 'sit_drape_mid' else 0.0)
            print('SHAPEKEY', n, kb.name, kb.value)
R.setup_workbench()
# character root ahead of the seated root along her front (anim_meta root_motion, as verify.py places it)
ch.top.location = (0, -float(os.environ.get('SD_ROOTZ', '0')), 0)
ch.pose(CLIP, T)
for v in VIEWS:
    loc, tg = R.SEAT_VIEWS[v]
    c = R.camera(v, loc, tg, lens=50)
    R.render(c, '%s_%s.png' % (OUT, v), int(RES * 0.8), RES)
