import bpy, mathutils
from mathutils.kdtree import KDTree
A='/workspace/wechat-game/art/x/GROKBOT-ART-001-INTERIOR-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0/'
bpy.ops.wm.open_mainfile(filepath=A+'scene/env_interior_assembled.blend')
M=bpy.data.objects['env_interior_props_merged']
vs=[M.matrix_world@v.co for v in M.data.vertices]
kd=KDTree(len(vs))
for i,v in enumerate(vs): kd.insert(v,i)
kd.balance()
for nm in ['env_int_prop_reading_chair','env_int_prop_reading_chair_arms']:
    with bpy.data.libraries.load(A+'assets/blend/%s.blend'%nm) as (src,dst):
        dst.objects=[n for n in src.objects]
    for o in dst.objects:
        if o.type!='MESH': continue
        print('CH',nm,o.name,'loc',[round(x,3) for x in o.location],'rot',[round(x,3) for x in o.rotation_euler],'scale',[round(x,3) for x in o.scale], 'parent',o.parent)
        Mw=mathutils.Matrix.Translation((0.4203,4.2133,0))@mathutils.Matrix.Rotation(-2.0,4,'Z')
        d=[kd.find(Mw@(o.matrix_basis@v.co))[2] for v in o.data.vertices]
        d.sort()
        print('  match', nm, 'n',len(d),'median',round(d[len(d)//2],4),'p90',round(d[int(len(d)*.9)],4),'max',round(d[-1],4))
        lo=[min(v.co[i] for v in o.data.vertices) for i in range(3)];hi=[max(v.co[i] for v in o.data.vertices) for i in range(3)]
        print('  local bbox',[round(x,3) for x in lo],[round(x,3) for x in hi])
