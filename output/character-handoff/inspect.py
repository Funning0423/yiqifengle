import bpy,json,os
from mathutils import Vector
base=os.getcwd(); report={}
for label,path in [('static','creator-build-project/assets/bundles/static_seat_preview/actor/user_static_seated_2k.glb'),('dynamic','creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')]:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.join(base,path))
 report[label]={'objects':[{ 'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None,'polygons':len(o.data.polygons) if o.type=='MESH' else None,'min':[min((o.matrix_world@v.co)[i] for v in o.data.vertices) for i in range(3)] if o.type=='MESH' else None,'max':[max((o.matrix_world@v.co)[i] for v in o.data.vertices) for i in range(3)] if o.type=='MESH' else None} for o in bpy.context.scene.objects],'actions':[a.name for a in bpy.data.actions]}
 if label=='dynamic':
  arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');report[label]['bones']=[b.name for b in arm.data.bones];print('ARM',arm.name,'NLA',[(t.name,[(s.name,s.action.name) for s in t.strips]) for t in arm.animation_data.nla_tracks]);
open(os.path.join(base,'output/character-handoff/blender-inspect.json'),'w').write(json.dumps(report,indent=2))
