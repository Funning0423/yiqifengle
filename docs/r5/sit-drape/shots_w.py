# UI bot's u3_probe.py unchanged, plus: BOW sit_drape driven at sit_drape weight (needs anim_meta morph.meshes entry) and cloth layer checks
import bpy, os
src = open('/workspace/u3/tools/u3_closeups.py').read()
scene = open('/workspace/u3/tools/u3_scene.py').read() + """
for o in CH_MESH:
    sk = o.data.shape_keys
    if o.name == 'LOD0_G2_BOW' and sk and 'sit_drape' in sk.key_blocks: sk.key_blocks['sit_drape'].value = W0.get('sit_drape', 0)
bpy.context.view_layer.update()
"""
src = src.replace("exec(open('/workspace/u3/tools/u3_scene.py').read())", "exec(SCENE)")
SCENE = scene; exec(src)
