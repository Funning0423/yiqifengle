# Decode a Draco GLB to a plain GLB (geometry only) for build-fixture.cjs. Blender 4.x, free/open-source.
# blender -b --python decode-draco-blender.py -- <in.glb> <out.glb>
import bpy,sys
src,dst=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_draco_mesh_compression_enable=False,export_animations=False,export_apply=False,export_yup=True,export_materials='NONE')
