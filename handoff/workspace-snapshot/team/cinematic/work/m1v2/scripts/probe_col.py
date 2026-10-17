import bpy, mathutils
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/wechat-game/src/QIFENGLE-COCOS-5b449fa-SOURCE/creator-build-project/assets/resources/firstslice/combined_visual_m.glb')
for o in bpy.data.objects:
    if 'col' in o.name or 'chair' in o.name:
        if o.type=='MESH':
            vs=[o.matrix_world@v.co for v in o.data.vertices]
            mn=[min(v[i] for v in vs) for i in range(3)];mx=[max(v[i] for v in vs) for i in range(3)]
            print('OB',o.name,o.type,len(vs),len(o.data.polygons),[round(x,3) for x in mn],[round(x,3) for x in mx])
        else: print('OB',o.name,o.type)
