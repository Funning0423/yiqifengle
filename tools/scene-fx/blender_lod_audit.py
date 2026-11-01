# QA only (场景特效bot r5 S3, docs/r5/scene-lod-scale.md): per GLB, per mesh object: triangles, world bbox (glTF metres, y up),
# materials and their texture sizes. blender -b --factory-startup -P blender_lod_audit.py -- out.json a.glb [b.glb ...]
import bpy, sys, json, os
a = sys.argv[sys.argv.index('--') + 1:]; OUT = a[0]; res = {}
for path in a[1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try: bpy.ops.import_scene.gltf(filepath=path)
    except Exception as e: res[path] = {'error': str(e)}; continue
    dg = bpy.context.evaluated_depsgraph_get(); objs = []; imgs = {}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris = len(me.loop_triangles)
        bb = [o.matrix_world @ v.co for v in me.vertices] if len(me.vertices) else []
        o.evaluated_get(dg).to_mesh_clear()
        if not bb: continue
        mn = [min(p[i] for p in bb) for i in range(3)]; mx = [max(p[i] for p in bb) for i in range(3)]
        mats = []
        for m in o.data.materials:
            if not m: continue
            t = []
            if m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image: t.append([n.image.name, list(n.image.size)]); imgs[n.image.name] = list(n.image.size)
            mats.append([m.name, t])
        # glTF axes: x, y(up) = blender z, z = -blender y
        objs.append({'name': o.name, 'tris': tris, 'min': [mn[0], mn[2], -mx[1]], 'max': [mx[0], mx[2], -mn[1]], 'mats': mats})
    res[path] = {'objects': objs, 'images': imgs, 'bytes': os.path.getsize(path)}
json.dump(res, open(OUT, 'w')); print('AUDIT', len(res))
