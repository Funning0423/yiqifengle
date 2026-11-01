# UI bot's u3_probe.py unchanged, plus: BOW sit_drape driven at sit_drape weight (needs anim_meta morph.meshes entry) and cloth layer checks
import bpy, os
src = open('/workspace/u3/tools/u3_probe.py').read()
scene = open('/workspace/u3/tools/u3_scene.py').read() + """
for o in CH_MESH:
    sk = o.data.shape_keys
    if o.name == 'LOD0_G2_BOW' and sk and 'sit_drape' in sk.key_blocks: sk.key_blocks['sit_drape'].value = W0.get('sit_drape', 0)
bpy.context.view_layer.update()
"""
src = src.replace("exec(open('/workspace/u3/tools/u3_scene.py').read())", "exec(SCENE)")
SCENE = scene; exec(src)
from mathutils.bvhtree import BVHTree as _B
M = {n: world_mesh(o) for n, o in [(o.name, o) for o in CH_MESH]}
def ov(a, b):
    A = _B.FromPolygons(*M[a]); Bb = _B.FromPolygons(*M[b]); return len(A.overlap(Bb))
print('LAYER', {f'{a}|{b}': ov(a, b) for a, b in [('LOD0_G2_DRESS', 'LOD0_G2_APRON'), ('LOD0_G2_DRESS', 'LOD0_G2_BODY'), ('LOD0_G2_APRON', 'LOD0_G2_BODY'), ('LOD0_G2_BOW', 'LOD0_G2_BODY'), ('LOD0_G2_BOW', 'LOD0_G2_DRESS')]})
