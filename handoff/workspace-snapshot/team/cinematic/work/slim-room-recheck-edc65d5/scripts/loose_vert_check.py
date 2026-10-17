import bpy
b=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']; me=b.data
used=set(v for p in me.polygons for v in p.vertices)
ids=[5970,5998,5971,4066,5999,6098,6067,6066,6099,6128,4367]
print('L',[(i,i in used) for i in ids],'loose total',len(me.vertices)-len(used))
hid=[p for p in me.polygons if p.hide]; print('L hidden faces',len(hid))
fm=[p for p in me.polygons if any(v in ids for v in p.vertices)]; print('L mats',set(b.material_slots[p.material_index].name for p in fm))
