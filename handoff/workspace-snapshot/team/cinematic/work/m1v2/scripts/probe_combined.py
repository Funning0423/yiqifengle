import bpy, mathutils, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/wechat-game/src/QIFENGLE-COCOS-5b449fa-SOURCE/creator-build-project/assets/resources/firstslice/combined_visual_m.glb')
S=mathutils.Vector((0.4203,4.2133,0.38))  # blender coords of seat anchor
for o in bpy.data.objects:
    if o.type=='MESH' and (o.name.startswith('col_int_chair') or o.name in('env_interior_props_merged',) or o.name.startswith('col_int_side') or o.name.startswith('col_int_floor')):
        mw=o.matrix_world
        vs=[mw@v.co for v in o.data.vertices]
        if o.name=='env_interior_props_merged':
            vs=[v for v in vs if (v-S).xy.length<0.5 and v.z<1.0]
        if not vs: continue
        mn=[min(v[i] for v in vs) for i in range(3)];mx=[max(v[i] for v in vs) for i in range(3)]
        print('OB',o.name,len(vs),[round(x,4) for x in mn],[round(x,4) for x in mx],'rot',[round(x,3) for x in o.matrix_world.to_euler()])
for n in ['seat_anchor','seat_back','door_hinge','door_handle','door_stand_point','stand_up_foot_anchor','seated_foot_anchor']:
    o=bpy.data.objects.get(n)
    if o: print('AN',n,[round(x,4) for x in o.matrix_world.translation],[round(x,3) for x in o.matrix_world.to_euler()])
