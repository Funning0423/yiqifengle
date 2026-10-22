import bpy,sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for b in arm.data.bones: print(b.name, b.parent.name if b.parent else '-', tuple(round(x,3) for x in b.head_local), tuple(round(x,3) for x in b.tail_local))
print([o.name for o in bpy.data.objects if o.type=='MESH'])
print([a.name for a in bpy.data.actions])
