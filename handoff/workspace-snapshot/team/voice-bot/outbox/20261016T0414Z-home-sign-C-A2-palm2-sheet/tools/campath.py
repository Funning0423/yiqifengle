import bpy,json,sys,math,mathutils
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; scene=json.load(open(a[0])); tracks=a[1:-1]; out=a[-1]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def cc(v): return mathutils.Vector((v[0],-v[2],v[1]))
def place(it):
    b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=it['glb']); objs=[o for o in bpy.data.objects if o not in b]
    E=bpy.data.objects.new(it['name'],None); sc.collection.objects.link(E)
    for r in [o for o in objs if o.parent is None]: r.parent=E
    E.location=cc(it['pos']); E.rotation_euler=(0,0,math.radians(it.get('yaw',0))); s=it.get('scale',1); E.scale=(s,s,s); return objs
bv={}
for it in scene['props']:
    if it['name'] not in ('signpost','beach_palm_tall'): continue
    objs=place(it); bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
    V=[];F=[]
    for o in objs:
        if o.type!='MESH': continue
        me=o.evaluated_get(dg).to_mesh(); mw=o.matrix_world; off=len(V)
        V+= [mw@v.co for v in me.vertices]; F+=[[off+i for i in p.vertices] for p in me.polygons]
        o.evaluated_get(dg).to_mesh_clear()
    bv[it['name']]=BVHTree.FromPolygons(V,F)
res={}
for tp in tracks:
    T=json.load(open(tp)); name=tp.split('track_')[1].split('.')[0]
    for ph in ('outbound','return'):
        fr=[f for f in T['frames'] if f['phase']==ph]; r={'frames':len(fr)}
        for k,b in bv.items():
            ds=[]; occ=[]
            for i,f in enumerate(fr):
                p=cc(f['position']); n=b.find_nearest(p); ds.append(n[3] if n[0] else 1e9)
                face=cc([f['root'][0],f['root'][1]+1.55,f['root'][2]]); d=face-p; L=d.length
                h=b.ray_cast(p,d.normalized(),L)
                if h[0] is not None: occ.append(i)
            m=min(range(len(ds)),key=lambda i:ds[i])
            r[k]={'min_dist_m':round(ds[m],3),'min_frame':m,'t':fr[m]['t'],'within_1m':[i for i,x in enumerate(ds) if x<1],'face_occluded':occ}
        res[f'{name}_{ph}']=r
json.dump(res,open(out,'w'),indent=1); print('CP_DONE')
