import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspace/wechat-game/yiqifengle/creator-build-project/assets/bundles/board_art/chest/result_chest.glb")
for o in bpy.data.objects: print("OBJ",o.name,o.type,o.parent.name if o.parent else None,tuple(round(v,2) for v in o.dimensions), [m.name for m in getattr(o.data,'materials',[])] if o.type=='MESH' else '')
for m in bpy.data.materials:
  b=m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
  print("MAT",m.name,tuple(round(x,3) for x in b.inputs['Base Color'].default_value) if b else None, bool(b and b.inputs['Base Color'].links))
for a in bpy.data.actions: print("ACT",a.name,a.frame_range)
