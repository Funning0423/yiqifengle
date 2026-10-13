import bpy,os,json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('archived-imports/static-seat-original-world/combined_visual_m.glb'))
original=next(o for o in bpy.context.scene.objects if o.name=='env_interior_props_merged')
bpy.ops.import_scene.gltf(filepath=os.path.abspath('creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb'))
remaining=next(o for o in bpy.context.scene.objects if o.name.startswith('env_interior_props_merged.') )
def key(o,p):
 return tuple(sorted(tuple(round(c,5) for c in (o.matrix_world@o.data.vertices[i].co)) for i in p.vertices))
kept={key(remaining,p) for p in remaining.data.polygons}
o=original;m=o.data;removed=[p for p in m.polygons if key(o,p) not in kept]
assert len(removed)==512, len(removed)
ids={i for p in removed for i in p.vertices};comps=[ids]
report=[{'object':o.name,'verts':len(ids),'faces':len(removed),'selection':'exact triangle difference original minus no-chair room; world positions quantized 1e-5m'}]
if comps:
  ids=set.union(*comps); vs=sorted(ids);remap={v:i for i,v in enumerate(vs)};polys=removed;mesh=bpy.data.meshes.new('RecoveredOriginalReadingChair');mesh.from_pydata([o.matrix_world@m.vertices[i].co for i in vs],[],[[remap[v] for v in p.vertices] for p in polys]);chair=bpy.data.objects.new('StationaryTransitionSupport',mesh);bpy.context.collection.objects.link(chair)
  # Preserve source material and UVs exactly, no texture rebake.
  for mat in m.materials:mesh.materials.append(mat)
  for name in m.uv_layers.keys():
   uv=mesh.uv_layers.new(name=name)
   for newp,oldp in zip(mesh.polygons,polys):
    for nl,ol in zip(newp.loop_indices,oldp.loop_indices):uv.data[nl].uv=m.uv_layers[name].data[ol].uv
  for newp,oldp in zip(mesh.polygons,polys):newp.material_index=oldp.material_index;newp.use_smooth=oldp.use_smooth
  bpy.ops.object.select_all(action='DESELECT');chair.select_set(True);bpy.context.view_layer.objects.active=chair
  os.makedirs('creator-build-project/assets/bundles/region_island/character_support',exist_ok=True)
  bpy.ops.export_scene.gltf(filepath=os.path.abspath('creator-build-project/assets/bundles/region_island/character_support/reading_chair.glb'),use_selection=True,export_yup=True,export_animations=False)
open('output/character-handoff/chair-components.json','w').write(json.dumps(report,indent=2))
