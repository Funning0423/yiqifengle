# QA only (not shipped): blender -b --factory-startup -P tools/scene-fx/qa/inspect_gull_wing_uv.py (GLB path is absolute; edit for your checkout)
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/场景特效bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
for n in ('env_anim_seagull_fly_01_v22_wing_L','env_anim_seagull_fly_01_v22_wing_R','env_anim_seagull_01'):
  o=bpy.data.objects.get(n)
  if not o: print('NONE',n);continue
  me=o.data;uv=me.uv_layers.active
  for p in me.polygons: print('F',n,list(p.vertices),'n',tuple(round(x,2) for x in p.normal),[tuple(round(c,3) for c in uv.data[li].uv) for li in p.loop_indices])
