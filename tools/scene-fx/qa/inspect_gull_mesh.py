# QA only (not shipped): blender -b --factory-startup -P tools/scene-fx/qa/inspect_gull_mesh.py (GLB path is absolute; edit for your checkout)
import bpy,bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/场景特效bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
for n in ('env_anim_seagull_fly_01_v22','env_anim_seagull_fly_01_v22_wing_L','env_anim_seagull_fly_01_v22_wing_R'):
  o=bpy.data.objects[n];me=o.data
  print('OBJ',n,len(me.vertices),len(me.polygons),'mat',[m.name for m in me.materials],'loc',tuple(round(x,3) for x in o.location),'rot',tuple(round(x,3) for x in o.rotation_quaternion),'scale',tuple(round(x,3) for x in o.scale))
  for v in me.vertices: print('  v',tuple(round(x,3) for x in v.co),'n',tuple(round(x,2) for x in v.normal))
  for p in me.polygons: print('  f',list(p.vertices),'n',tuple(round(x,2) for x in p.normal))
  uv=me.uv_layers.active
  if uv: print('  uv',sorted(set((round(l.uv[0],3),round(l.uv[1],3)) for l in uv.data))[:12])
m=bpy.data.objects['env_anim_seagull_fly_01_v22'].data.materials[0]
print('MAT',m.name,[ (n.type,n.name) for n in m.node_tree.nodes], m.use_backface_culling)
for n in m.node_tree.nodes:
  if n.type=='TEX_IMAGE': print('IMG',n.image.name,n.image.size[:])
