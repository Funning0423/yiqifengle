# QA only (not shipped): blender -b --factory-startup -P tools/scene-fx/qa/inspect_sea_material.py (GLB path is absolute; edit for your checkout)
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/场景特效bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
for o in bpy.data.objects:
    if 'sea_surface' in o.name: print('OBJ',o.name,o.type,[ (m.name,[n.type for n in m.node_tree.nodes]) for m in o.data.materials if m])
