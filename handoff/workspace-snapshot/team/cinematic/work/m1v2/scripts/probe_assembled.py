import bpy, mathutils, math
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/art/x/GROKBOT-ART-001-INTERIOR-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0/scene/env_interior_assembled.blend')
S=mathutils.Vector((0.4203,4.2133,0.38))
R=mathutils.Matrix.Rotation(2.0,4,'Z')
for o in bpy.data.objects:
    if o.type=='MESH':
        vs=[o.matrix_world@v.co for v in o.data.vertices]
        near=[v for v in vs if (v-S).xy.length<0.55 and v.z<1.0]
        mn=[min(v[i] for v in vs) for i in range(3)];mx=[max(v[i] for v in vs) for i in range(3)]
        print('OB',o.name,len(vs),[round(x,3) for x in mn],[round(x,3) for x in mx],'near',len(near), 'coll',[c.name for c in o.users_collection])
        if near and not o.name.startswith('col_'):
            L=[R@(v-mathutils.Vector((S.x,S.y,0))) for v in near]
            print('  LOCAL',[round(min(v[i] for v in L),3) for i in range(3)],[round(max(v[i] for v in L),3) for i in range(3)])
    else: print('OB',o.name,o.type)
