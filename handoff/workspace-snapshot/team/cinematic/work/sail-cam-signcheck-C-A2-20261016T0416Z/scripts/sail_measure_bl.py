# Blender: same geometry loading + BVH nearest/ray method as Voice Bot camera_path/campath.py, applied to the sail track.
import bpy,json,sys,math,mathutils,csv
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:]; scene=json.load(open(a[0])); track=json.load(open(a[1])); out=a[2]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def cc(v): return mathutils.Vector((v[0],-v[2],v[1]))
def imp(path):
    b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); return [o for o in bpy.data.objects if o not in b]
def place(it):
    objs=imp(it['glb']); E=bpy.data.objects.new(it['name'],None); sc.collection.objects.link(E)
    for r in [o for o in objs if o.parent is None]: r.parent=E
    E.location=cc(it['pos']); E.rotation_euler=(0,0,math.radians(it.get('yaw',0))); s=it.get('scale',1); E.scale=(s,s,s); return objs
def bvh(objs,skip=()):
    bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get(); V=[];F=[]
    for o in objs:
        if o.type!='MESH' or any(h in o.name for h in skip): continue
        me=o.evaluated_get(dg).to_mesh(); mw=o.matrix_world; off=len(V)
        V+=[mw@v.co for v in me.vertices]; F+=[[off+i for i in p.vertices] for p in me.polygons]; o.evaluated_get(dg).to_mesh_clear()
    return BVHTree.FromPolygons(V,F),V
bv={}
for it in scene['props']:
    if it['name'] in ('signpost','beach_palm_tall'): bv[it['name']]=bvh(place(it))[0]
isl,_=bvh(imp(scene['island']),scene.get('hide',[])); bv['island']=isl
rows=[]
for f in track['frames']:
    if f['scene']!='island': rows.append({'frame':f['frame'],'t':round(f['t'],4),'scene':'meadow'}); continue
    p=cc(f['position']); r={'frame':f['frame'],'t':round(f['t'],4),'scene':'island','departure':round(f['departure'],4),'fov':round(f['fovVerticalDeg'],3),
       'cam_x':round(f['position'][0],3),'cam_y':round(f['position'][1],3),'cam_z':round(f['position'][2],3),'actor_visible':int(f['actorVisible'])}
    R=f['root']
    for k,b in bv.items():
        n=b.find_nearest(p); r['dist_'+k]=round(n[3],3)
    for tag,h in (('face',1.55),('feet',0.0),('head',1.7253)):
        q=cc([R[0],R[1]+h,R[2]]); d=q-p; L=d.length; hit=None
        for k in ('signpost','beach_palm_tall'):
            x=bv[k].ray_cast(p,d.normalized(),L-1e-3)
            if x[0] is not None: hit=k
        r['occl_'+tag]=hit or ''
    rows.append(r)
json.dump(rows,open(out,'w')); print('SAIL_DONE',len(rows))
